import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import { NbDialogService } from '@nebular/theme';
import { cloneDeep, isEqual } from 'lodash';
import { BehaviorSubject } from 'rxjs';
import { of } from 'rxjs/internal/observable/of';
import { skip, skipWhile, take, takeUntil } from 'rxjs/operators';

import { UploadedFile } from 'app/@theme/components/file-uploader/file-uploader.service';
import { BaseExpenseComponent } from 'app/shared/components/base-expense/base-expense.component';
import { ConfigService } from 'app/shared/services/config.service';
import { OneDriveFolders, OneDriveService } from 'app/shared/services/onedrive.service';
import { ProviderService } from 'app/shared/services/provider.service';
import { StringUtilService } from 'app/shared/services/string-util.service';
import { TeamService } from 'app/shared/services/team.service';
import { NORTAN, UserService } from 'app/shared/services/user.service';
import { compareFiles, forceValidatorUpdate, formatDate } from 'app/shared/utils';

import { Team, TeamExpense } from '@models/team';
import { User } from '@models/user';

import expense_validation from 'app/shared/validators/expense-validation.json';

@Component({
  selector: 'ngx-team-expense-item',
  templateUrl: './team-expense-item.component.html',
  styleUrls: ['./team-expense-item.component.scss'],
})
export class TeamExpenseItemComponent extends BaseExpenseComponent implements OnInit {
  @Input() iTeam: Team = new Team();
  @Input() expenseIdx?: number;
  @Input() isFormDirty = new BehaviorSubject<boolean>(false);
  validation = expense_validation as any;
  types: string[] = [];
  subTypes: string[] = [];

  options = {
    lastValue: '0',
    lastTeam: [],
  };
  splitSelectedMember = new User();

  expense: TeamExpense = {
    author: '',
    source: '',
    description: '',
    nf: true,
    type: '',
    subType: '',
    value: '',
    created: this.today,
    lastUpdate: this.today,
    paid: true,
    uploadedFiles: [],
    code: '#0',
  };

  initialFiles: UploadedFile[] = [];
  registered: boolean = false;
  folderPath: string = '';

  formatDate = formatDate;
  forceValidatorUpdate = forceValidatorUpdate;
  OneDriveFolders = OneDriveFolders;

  constructor(
    protected stringUtil: StringUtilService,
    protected onedrive: OneDriveService,
    protected providerService: ProviderService,
    protected dialogService: NbDialogService,
    public configService: ConfigService,
    public teamService: TeamService,
    public userService: UserService
  ) {
    super(stringUtil, onedrive, dialogService, providerService, userService);
    this.expense.code = '#0';
  }

  ngOnInit(): void {
    super.ngOnInit();
    this.registered = false;
    const tmp = cloneDeep(this.userService.getUsers().value.filter((user) => user.active));
    this.userData = of(cloneDeep(tmp));
    this.configService
      .getConfig()
      .pipe(
        skipWhile((config) => config.length == 0),
        takeUntil(this.destroy$)
      )
      .subscribe((config) => {
        this.types = config[0].expenseConfig.adminExpenseTypes.map((eType) => eType.name);
      });
    tmp.unshift(NORTAN);
    this.sourceData = of(tmp);
    if (this.expenseIdx) {
      this.updateUploaderOptions();
      this.expense = cloneDeep(this.iTeam.expenses[this.expenseIdx]);
      if (this.expense.author) this.expense.author = this.userService.idToUser(this.expense.author);
      if (this.expense.source) this.expense.source = this.userService.idToUser(this.expense.source);
      if (this.expense.provider) this.expense.provider = this.providerService.idToProvider(this.expense.provider);
      this.uploadedFiles = cloneDeep(this.expense.uploadedFiles) as UploadedFile[];
      this.handleTypeChange();
      this.initialFiles = cloneDeep(this.uploadedFiles) as UploadedFile[];
    } else {
      this.expense.code = '#' + this.iTeam.expenses.length.toString();
      this.userService.currentUser$.pipe(take(1)).subscribe((author) => {
        this.expense.author = author;
      });
      this.updatePaidDate();
    }

    this.userSearch = this.expense.author ? this.userService.idToUser(this.expense.author)?.fullName : '';
    this.sourceSearch = this.expense.source ? this.userService.idToUser(this.expense.source)?.fullName : '';
    this.providerSearch = this.expense.provider
      ? this.providerService.idToProvider(this.expense.provider)?.fullName
      : '';
  }

  ngAfterViewInit(): void {
    this.formRef.control.statusChanges.pipe(skip(1), takeUntil(this.destroy$)).subscribe((status) => {
      if (this.formRef.dirty) this.isFormDirty.next(true);
      if (status === 'VALID' && this.expense.nf === true) this.updateUploaderOptions();
    });
  }

  ngOnDestroy(): void {
    if (!this.registered && !isEqual(this.initialFiles, this.uploadedFiles)) {
      this.deleteFiles();
    }
    super.ngOnDestroy();
  }

  registerExpense(): void {
    let creatingExpense = false;
    this.registered = true;
    this.expense.uploadedFiles = cloneDeep(this.uploadedFiles);
    if (this.expenseIdx !== undefined) {
      this.expense.lastUpdate = new Date();
      this.iTeam.expenses[this.expenseIdx] = cloneDeep(this.expense);
    } else {
      creatingExpense = true;
      this.iTeam.expenses.push(cloneDeep(this.expense));
    }
    this.teamService.editTeam(cloneDeep(this.iTeam), creatingExpense);
    this.isFormDirty.next(false);
    this.submit.emit();
  }

  addAndClean(): void {
    this.registered = true;
    this.expense.uploadedFiles = cloneDeep(this.uploadedFiles);
    this.iTeam.expenses.push(cloneDeep(this.expense));
    this.teamService.editTeam(cloneDeep(this.iTeam));
    this.sourceSearch = '';
    this.expense.source = '';
    this.expense.description = '';
    this.expense.value = '';
    this.uploadedFiles = [];
    this.expense.created = this.today;
    this.expense.lastUpdate = this.today;
    this.expense.paid = true;
    this.formRef.form.markAsPristine();
    this.isFormDirty.next(false);
  }

  updateUploaderOptions(): void {
    const mediaFolderPath = 'SFC/Comprovantes';
    const fn = (name: string) => {
      const type = this.expense.type;
      const date = formatDate(new Date(), '-');
      const extension = name.match('[.].+');
      if (this.configService.expenseSubTypes(this.expense.type).length > 0) {
        const subType = this.expense.subType;
        return 'Comprovante-' + type + '-' + subType + '-' + date + extension;
      }
      return 'Comprovante-' + type + '-' + date + extension;
    };
    this.folderPath = mediaFolderPath;
    super.updateUploaderOptions(mediaFolderPath, fn, OneDriveFolders.TEAMS);
  }

  handleTypeChange(): void {
    this.subTypes = this.configService.expenseSubTypes(this.expense.type);
    if (this.subTypes.length == 0) this.expense.subType = '';
  }

  updatePaidDate(): void {
    if (!this.expense.paid) this.expense.paidDate = undefined;
    else this.expense.paidDate = new Date();
  }

  deleteFiles(): void {
    const filesToRemove = this.uploadedFiles.filter((file) => !compareFiles(this.initialFiles, file));
    this.onedrive.deleteFiles(this.folderPath, filesToRemove, OneDriveFolders.TEAMS);
  }
}
