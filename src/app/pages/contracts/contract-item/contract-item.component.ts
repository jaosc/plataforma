import { Component, OnInit, Output, EventEmitter, Input } from '@angular/core';
import { CompleterService, CompleterData } from 'ng2-completer';
import { ContractService } from '../../../shared/services/contract.service';
import { StringUtilService } from '../../../shared/services/string-util.service';
import { UtilsService } from 'app/shared/services/utils.service';
import { UserService } from 'app/shared/services/user.service';
import { NbDialogService } from '@nebular/theme';
import { ContractDialogComponent } from '../contract-dialog/contract-dialog.component';
import { format, parseISO } from 'date-fns';
import * as contract_validation from '../../../shared/contract-validation.json';

@Component({
  selector: 'ngx-contract-item',
  templateUrl: './contract-item.component.html',
  styleUrls: ['./contract-item.component.scss'],
})
export class ContractItemComponent implements OnInit {
  @Input() iContract: any;
  @Input() index: number;
  @Output() submit = new EventEmitter<void>();
  contract: any;
  submitted = false;
  contractNumber: number;
  today = new Date();
  todayDate = format(this.today, 'dd/MM/yyyy');
  validation = (contract_validation as any).default;
  STATOOS = ['Em andamento', 'Concluído', 'Arquivado'];
  INTERESTS = [...Array(24).keys()].map((index) => (index + 1).toString());
  paymentIcon = {
    icon: 'dollar-sign',
    pack: 'fa',
  };
  options = {
    valueType: '%',
  };

  teamMember: any = {};
  userSearch: string;
  userData: CompleterData;

  constructor(
    private contractService: ContractService,
    private dialogService: NbDialogService,
    private stringUtil: StringUtilService,
    private completerService: CompleterService,
    private userService: UserService,
    private utils: UtilsService
  ) {}

  ngOnInit(): void {
    this.contract = this.utils.deepCopy(this.iContract);
    this.contract.interest = this.contract.payments.length;
    this.contract.paid = this.stringUtil.numberToMoney(
      this.contract.payments.reduce(
        (accumulator: number, payment: any) =>
          accumulator + this.stringUtil.moneyToNumber(payment.value),
        0
      )
    );
    if (
      this.contract.created !== undefined &&
      typeof this.contract.created !== 'object'
    )
      this.contract.created = parseISO(this.contract.created);
    if (
      this.contract.lastUpdate !== undefined &&
      typeof this.contract.lastUpdate !== 'object'
    ) {
      this.contract.lastUpdate = parseISO(this.contract.lastUpdate);
      this.contract.lastUpdate = format(this.contract.lastUpdate, 'dd/MM/yyyy');
    }
    if (!this.contract.team || this.contract.team?.length == 0) {
      this.contract.team = this.utils.deepCopy(this.contract.invoice.team);
      this.contract.team = this.contract.team.map((member) => {
        member.user = this.userService.idToUser(member.user);
        return member;
      });
      this.contract.team.unshift({
        user: this.contract.invoice.author,
        coordination: 'CAD',
      });
      console.log(this.contract.team);
    } else {
      this.contract.team = this.contract.team.map((member) => {
        member.user = this.userService.idToUser(member.user);
        return member;
      });
    }
    this.userData = this.completerService
      .local(this.userService.getUsersList(), 'fullName', 'fullName')
      .imageField('profilePicture');
  }

  updateContract(): void {
    this.submitted = true;
    let version = +this.contract.version;
    version += 1;
    this.contract.version = version.toString().padStart(2, '0');
    this.contract.lastUpdate = new Date();
    this.iContract = this.utils.deepCopy(this.contract);
    this.contractService.editContract(this.contract);
    this.submit.emit();
  }

  paymentDialog(index: number): void {
    this.dialogService.open(ContractDialogComponent, {
      context: {
        title:
          index != undefined
            ? 'ORDEM DE EMPENHO'
            : 'ADICIONAR ORDEM DE EMPENHO',
        contract: this.contract,
        contractIndex: this.index,
        paymentIndex: index != undefined ? index : undefined,
      },
      dialogClass: 'my-dialog',
      closeOnBackdropClick: false,
      closeOnEsc: false,
      autoFocus: false,
    });
  }

  tooltipText(): string {
    return (
      `CPF/CNPJ: ` +
      this.contract.invoice.contractor.document +
      `\nEmail: ` +
      this.contract.invoice.contractor.email +
      `\nEndereço: ` +
      this.contract.invoice.contractor.address
    );
  }

  addColaborator(): void {
    if (this.options.valueType == '$')
      this.teamMember.distribution = this.stringUtil
        .toPercentage(this.teamMember.distribution, this.contract.total)
        .slice(0, -1);
    this.contract.team.push(Object.assign({}, this.teamMember));
    this.userSearch = undefined;
    this.teamMember = {};
  }

  trackByIndex(index: number, obj: any): any {
    return index;
  }
}
