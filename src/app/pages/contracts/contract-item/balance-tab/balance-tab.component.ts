import { Component, Input, OnInit } from '@angular/core';
import { combineLatest, skipWhile, Subject, take } from 'rxjs';

import { ConfigService } from 'app/shared/services/config.service';
import { ContractService } from 'app/shared/services/contract.service';
import { InvoiceService } from 'app/shared/services/invoice.service';
import { StringUtilService } from 'app/shared/services/string-util.service';
import { CLIENT, CONTRACT_BALANCE, UserService } from 'app/shared/services/user.service';
import { idToProperty, isPhone, nfPercentage, nortanPercentage, trackByIndex } from 'app/shared/utils';

import { Contract } from '@models/contract';
import { Invoice, InvoiceTeamMemberLocals } from '@models/invoice';
import { PlatformConfig } from '@models/platformConfig';

interface ExpenseSourceSum {
  user: string;
  value: string;
}

@Component({
  selector: 'ngx-balance-tab',
  templateUrl: './balance-tab.component.html',
  styleUrls: ['./balance-tab.component.scss'],
})
export class BalanceTabComponent implements OnInit {
  @Input() clonedContract: Contract = new Contract();
  private destroy$ = new Subject<void>();

  comissionSum = '';
  contractId!: string;
  invoice: Invoice = new Invoice();
  options = {
    liquid: '0,00',
    paid: '0,00',
    hasISS: false,
    interest: 0,
    notaFiscal: '0',
    nortanPercentage: '0',
  };

  teamTotal = {
    grossValue: '0,00',
    netValue: '0,00',
    distribution: '0,00',
  };

  contractorIcon = {
    icon: 'client',
    pack: 'fac',
  };

  chartIcon = {
    icon: 'chart-bar',
    pack: 'fa',
  };

  config: PlatformConfig = new PlatformConfig();

  isPhone = isPhone;
  trackByIndex = trackByIndex;
  idToProperty = idToProperty;

  constructor(
    private invoiceService: InvoiceService,
    private configService: ConfigService,
    public stringUtil: StringUtilService,
    public contractService: ContractService,
    public userService: UserService
  ) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnInit(): void {
    combineLatest([this.configService.getConfig(), this.configService.isDataLoaded$])
      .pipe(
        skipWhile(([_, isConfigDataLoaded]) => !isConfigDataLoaded),
        take(1)
      )
      .subscribe(([configs, _]) => {
        this.config = configs[0];
        this.options.notaFiscal = nfPercentage(this.clonedContract, this.config.invoiceConfig);
        this.options.nortanPercentage = nortanPercentage(this.clonedContract, this.config.invoiceConfig);
      });
    if (this.clonedContract.invoice) this.invoice = this.invoiceService.idToInvoice(this.clonedContract.invoice);
    this.invoice.team.forEach(
      (teamMember) => (teamMember.locals = !teamMember.locals ? ({} as InvoiceTeamMemberLocals) : teamMember.locals)
    );
    this.calculatePaidValue();
    this.calculateBalance();
    this.contractId = this.clonedContract._id;
    this.comissionSum = this.stringUtil.numberToMoney(this.contractService.getComissionsSum(this.clonedContract));
    this.options.interest = this.clonedContract.receipts.length;
  }

  expenseSourceSum(): ExpenseSourceSum[] {
    const result = this.clonedContract.expenses.reduce(
      (sum: ExpenseSourceSum[], expense) => {
        if (expense.source != undefined) {
          const source = this.userService.idToShortName(expense.source);
          const idx = sum.findIndex((el) => el.user == source);
          if (idx != -1) sum[idx].value = this.stringUtil.sumMoney(sum[idx].value, expense.value);
        }
        return sum;
      },
      [CONTRACT_BALANCE.fullName, CLIENT.fullName]
        .concat(
          this.invoice.team
            .map((member) => {
              if (member.user) return this.userService.idToShortName(member.user);
              return '';
            })
            .filter((n) => n.length > 0)
        )
        .map((name) => ({ user: name, value: '0,00' }))
    );
    const contractor = result.splice(1, 1)[0];
    const total = result.reduce((sum, expense) => this.stringUtil.sumMoney(sum, expense.value), '0,00');
    result.push({ user: 'TOTAL', value: total });
    result.push(contractor);
    return result;
  }

  updateTeamTotal(): void {
    this.teamTotal = this.invoice.team.reduce(
      (sum, member) => {
        sum.grossValue = this.stringUtil.sumMoney(sum.grossValue, member.locals.grossValue);
        sum.netValue = this.stringUtil.sumMoney(sum.netValue, member.locals.netValue);
        sum.distribution = this.stringUtil.sumMoney(sum.distribution, member.distribution);
        return sum;
      },
      {
        grossValue: '0,00',
        netValue: '0,00',
        distribution: '0,00',
      }
    );
  }

  updateLiquid(): void {
    this.clonedContract.locals.liquid = this.contractService.contractNetValue(this.clonedContract);
    this.clonedContract.locals.cashback = this.stringUtil.numberToMoney(
      this.contractService.expensesContributions(this.clonedContract).global.cashback
    );
    if (this.clonedContract.invoice != undefined) {
      const invoice = this.invoiceService.idToInvoice(this.clonedContract.invoice);
      invoice.team.map((member, index) => {
        member.locals.netValue = this.stringUtil.applyPercentage(
          this.clonedContract.locals.liquid,
          member.distribution
        );
        this.updateGrossValue(index);
        this.updateTeamTotal();
      });
    }
  }

  updateGrossValue(idx?: number): void {
    if (idx != undefined) {
      this.invoice.team[idx].locals.grossValue = this.contractService.toGrossValue(
        this.invoice.team[idx].locals.netValue,
        this.options.notaFiscal,
        this.options.nortanPercentage
      );
      this.updateTeamTotal();
    }
  }

  calculatePaidValue(): void {
    this.options.interest = this.clonedContract.receipts.length;
    this.options.nortanPercentage = nortanPercentage(this.clonedContract, this.config.invoiceConfig);
    this.options.notaFiscal = nfPercentage(this.clonedContract, this.config.invoiceConfig);
    this.updateLiquid();
    this.options.paid = this.contractService.paidValue(this.clonedContract);
    this.clonedContract.locals.notPaid = this.stringUtil.numberToMoney(
      this.stringUtil.moneyToNumber(
        this.contractService.toNetValue(
          idToProperty(this.clonedContract.invoice, this.invoiceService.idToInvoice.bind(this.invoiceService), 'value'),
          this.options.notaFiscal,
          this.options.nortanPercentage,
          this.clonedContract.created
        )
      ) - this.stringUtil.moneyToNumber(this.options.paid)
    );
  }

  calculateBalance(): void {
    this.clonedContract.locals.balance = this.contractService.balance(this.clonedContract);
  }
}
