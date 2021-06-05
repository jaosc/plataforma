import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import { NbDialogService, NbComponentStatus } from '@nebular/theme';
import {
  ContractDialogComponent,
  ComponentTypes,
} from './contract-dialog/contract-dialog.component';
import { LocalDataSource } from 'ng2-smart-table';
import { ContractService } from 'app/shared/services/contract.service';
import { ContractorService } from 'app/shared/services/contractor.service';
import { InvoiceService } from 'app/shared/services/invoice.service';
import { UserService } from 'app/shared/services/user.service';
import { MetricsService } from 'app/shared/services/metrics.service';
import { StringUtilService } from 'app/shared/services/string-util.service';
import { UtilsService, Permissions } from 'app/shared/services/utils.service';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { saveAs } from 'file-saver';
import { take, takeUntil } from 'rxjs/operators';
import { Subject, combineLatest } from 'rxjs';
import { NbAccessChecker } from '@nebular/security';
import { Contract } from '../../../../backend/src/models/contract';
import { Invoice } from '../../../../backend/src/models/invoice';

@Component({
  selector: 'ngx-contracts',
  templateUrl: './contracts.component.html',
  styleUrls: ['./contracts.component.scss'],
})
export class ContractsComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('smartTable', { read: ElementRef }) tableRef!: ElementRef;
  private destroy$ = new Subject<void>();
  contracts: Contract[] = [];
  searchQuery = '';
  get filtredContracts(): Contract[] {
    if (this.searchQuery !== '')
      return this.contracts.filter((contract) => {
        return (
          contract.fullName
            .toLowerCase()
            .includes(this.searchQuery.toLowerCase()) ||
          contract.code
            .toLowerCase()
            .includes(this.searchQuery.toLowerCase()) ||
          contract.contractor
            .toLowerCase()
            .includes(this.searchQuery.toLowerCase()) ||
          contract.name
            .toLowerCase()
            .includes(this.searchQuery.toLowerCase()) ||
          contract.value
            .toLowerCase()
            .includes(this.searchQuery.toLowerCase()) ||
          contract.status.toLowerCase().includes(this.searchQuery.toLowerCase())
        );
      });
    return this.contracts.sort((a, b) => this.codeSort(-1, a.code, b.code));
  }
  settings = {
    mode: 'external',
    noDataMessage: 'Não encontramos nenhum contrato para o filtro selecionado.',
    add: {
      addButtonContent: '<i class="icon-file-csv"></i>',
      createButtonContent: '<i class="nb-checkmark"></i>',
      cancelButtonContent: '<i class="nb-close"></i>',
    },
    edit: {
      editButtonContent: '<i class="nb-edit"></i>',
      saveButtonContent: '<i class="nb-checkmark"></i>',
      cancelButtonContent: '<i class="nb-close"></i>',
    },
    delete: {
      deleteButtonContent: '<i class="fa fa-dollar-sign payment"></i>',
      confirmDelete: false,
    },
    actions: {
      columnTitle: 'Ações',
      add: true,
      edit: true,
      delete: true,
    },
    columns: {
      fullName: {
        title: 'Autor',
        type: 'string',
      },
      code: {
        title: 'Código',
        type: 'string',
        sortDirection: 'desc',
        compareFunction: this.codeSort,
      },
      contractor: {
        title: 'Cliente',
        type: 'string',
      },
      name: {
        title: 'Empreendimento',
        type: 'string',
      },
      role: {
        title: 'Papel',
        type: 'string',
        width: '10%',
        filter: {
          type: 'list',
          config: {
            selectText: 'Todos',
            list: [
              { value: 'Gestor', title: 'Gestor' },
              { value: 'Equipe', title: 'Equipe' },
              { value: 'Equipe Gestor', title: 'Ambos' },
              { value: 'Nenhum', title: 'Nenhum' },
            ],
          },
        },
        filterFunction(cell: string, search?: string): boolean {
          if (search && search.includes(cell)) return true;
          return false;
        },
      },
      value: {
        title: 'Valor',
        type: 'string',
        width: '10%',
        compareFunction: this.valueSort,
      },
      interests: {
        title: 'Parcelas',
        type: 'string',
        width: '50px',
      },
      status: {
        title: 'Status',
        type: 'string',
        width: '10%',
        filter: {
          type: 'list',
          config: {
            selectText: 'Todos',
            list: [
              { value: 'Em andamento A receber', title: 'Ativo' },
              { value: 'Em andamento', title: 'Em andamento' },
              { value: 'A receber', title: 'A receber' },
              { value: 'Concluído', title: 'Concluído' },
              { value: 'Arquivado', title: 'Arquivado' },
            ],
          },
        },
        filterFunction(cell: string, search?: string): boolean {
          if (search && search.includes(cell)) return true;
          return false;
        },
      },
    },
  };

  source: LocalDataSource = new LocalDataSource();

  constructor(
    private dialogService: NbDialogService,
    private contractService: ContractService,
    private contractorService: ContractorService,
    private invoiceService: InvoiceService,
    private userService: UserService,
    private metricsService: MetricsService,
    private stringUtil: StringUtilService,
    private accessChecker: NbAccessChecker,
    public utils: UtilsService
  ) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /* eslint-disable @typescript-eslint/indent */
  ngOnInit(): void {
    combineLatest([
      this.contractService.getContracts(),
      this.invoiceService.getInvoices(),
      this.contractorService.getContractors(),
      this.userService.currentUser$,
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([contracts, invoices, contractors, user]) => {
        if (
          contracts.length > 0 &&
          invoices.length > 0 &&
          contractors.length > 0
        ) {
          this.contracts = contracts.map((contract: Contract) => {
            if (contract.invoice) {
              const invoice = this.invoiceService.idToInvoice(contract.invoice);
              if (invoice.author) {
                contract.fullName = this.userService.idToShortName(
                  invoice.author
                );
              }
              if (invoice.contractor) {
                contract.contractor = this.contractorService.idToName(
                  invoice.contractor
                );
              }
              contract.code = this.invoiceService.idToInvoice(
                contract.invoice
              ).code;
              contract.name = invoice.name;
              contract.value = invoice.value;
              contract.interests =
                contract.receipts.length.toString() + '/' + contract.total;
              contract.role = this.invoiceService.role(invoice, user);
            }
            return contract;
          });
          this.source.load(this.contracts);
        }
      });
    this.accessChecker
      .isGranted(Permissions.ELO_PRINCIPAL, 'export-csv')
      .pipe(takeUntil(this.destroy$))
      .subscribe((isGranted) => (this.settings.actions.add = isGranted));
  }
  /* eslint-enable @typescript-eslint/indent */

  ngAfterViewInit(): void {
    combineLatest([
      this.contractService.getContracts(),
      this.invoiceService.getInvoices(),
      this.contractorService.getContractors(),
    ])
      .pipe(take(4))
      .subscribe(([contracts, invoices, contractors]) => {
        if (
          contracts.length > 0 &&
          invoices.length > 0 &&
          contractors.length > 0 &&
          !this.utils.isPhone()
        ) {
          setTimeout(() => {
            this.tableRef.nativeElement.children[0].children[0].children[1].children[5].children[0].children[0].children[0].children[0].children[0].value =
              'Equipe Gestor';
            this.tableRef.nativeElement.children[0].children[0].children[1].children[5].children[0].children[0].children[0].children[0].children[0].dispatchEvent(
              new Event('change')
            );
            this.tableRef.nativeElement.children[0].children[0].children[1].children[8].children[0].children[0].children[0].children[0].children[0].value =
              'Em andamento A receber';
            this.tableRef.nativeElement.children[0].children[0].children[1].children[8].children[0].children[0].children[0].children[0].children[0].dispatchEvent(
              new Event('change')
            );
          }, 1);
        }
      });
  }

  contractDialog(
    event: { data: any; index: string },
    isEditing: boolean
  ): void {
    this.dialogService.open(ContractDialogComponent, {
      context: {
        title: isEditing ? 'EDIÇÃO DE CONTRATO' : 'ADICIONAR ORDEM DE EMPENHO',
        contract: event.data,
        contractIndex: +event.index,
        componentType: isEditing
          ? ComponentTypes.CONTRACT
          : ComponentTypes.RECEIPT,
      },
      dialogClass: 'my-dialog',
      closeOnBackdropClick: false,
      closeOnEsc: false,
      autoFocus: false,
    });
  }

  pageWidth(): number {
    return window.innerWidth;
  }

  statusColor(status: string): NbComponentStatus {
    switch (status) {
      case 'Em andamento':
        return 'warning';
      case 'Concluído':
        return 'success';
      case 'Arquivado':
        return 'danger';
      default:
        return 'warning';
    }
  }

  valueSort(direction: number, a: string, b: string): number {
    const first = +a.replace(/[,.]/g, '');
    const second = +b.replace(/[,.]/g, '');

    if (first < second) {
      return -1 * direction;
    }
    if (first > second) {
      return direction;
    }
    return 0;
  }

  codeSort(direction: number, a: string, b: string): number {
    let first = 0;
    let second = 0;
    let tmp = a.match(/-(\d+)\//g);
    if (tmp) tmp = tmp[0].match(/\d+/g);
    if (tmp) first = +tmp[0];
    tmp = b.match(/-(\d+)\//g);
    if (tmp) tmp = tmp[0].match(/\d+/g);
    if (tmp) second = +tmp[0];

    if (first < second) {
      return -1 * direction;
    }
    if (first > second) {
      return direction;
    }
    return 0;
  }

  invoiceAuthorPic(iId: string | Invoice | undefined): string {
    if (iId === undefined) return '';
    const invoice = this.invoiceService.idToInvoice(iId);
    if (invoice.author === undefined) return '';
    const pic = this.userService.idToUser(invoice.author).profilePicture;
    if (pic === undefined) return '';
    return pic;
  }

  downloadReport(): void {
    this.metricsService
      .receivedValueList('Mês')
      .pipe(take(1))
      .subscribe((data) => {
        const lastMonth = format(subMonths(new Date(), 1), 'MMMM-yyyy', {
          locale: ptBR,
        });
        const csv = Object.keys(data).map((key) => {
          return key + ';' + this.stringUtil.numberToMoney(data[key]);
        });

        const csvArray = csv.join('\r\n');

        const blob = new Blob([csvArray], { type: 'text/csv' });
        saveAs(blob, 'valoresRecebidos-' + lastMonth + '.csv');
      });
  }
}
