import { Component, OnDestroy, OnInit } from '@angular/core';
import { NbDialogService } from '@nebular/theme';
import { combineLatest, Subject } from 'rxjs';
import { skipWhile, takeUntil } from 'rxjs/operators';

import { TeamDialogComponent } from './team-dialog/team-dialog.component';
import { LocalDataSource } from 'app/@theme/components/smart-table/lib/data-source/local/local.data-source';
import { TeamService } from 'app/shared/services/team.service';
import { UserService } from 'app/shared/services/user.service';
import { idToProperty, isPhone, nameSort, NOT } from 'app/shared/utils';

import { Sector } from '@models/shared/sector';
import { Team } from '@models/team';
import { User } from '@models/user';

@Component({
  selector: 'ngx-teams',
  templateUrl: './teams.component.html',
  styleUrls: ['./teams.component.scss'],
})
export class TeamsComponent implements OnInit, OnDestroy {
  destroy$ = new Subject<void>();
  teams: Team[] = [];
  searchQuery = '';
  NOT = NOT;
  get filtredTeams(): Team[] {
    if (this.searchQuery !== '')
      return this.teams.filter((team) => {
        return (
          team.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
          idToProperty(team.leader, this.userService.idToUser.bind(this.userService), 'fullName')
            .toLowerCase()
            .includes(this.searchQuery.toLowerCase()) ||
          team.abrev.toLowerCase().includes(this.searchQuery.toLowerCase())
        );
      });
    return this.teams.sort((a, b) => {
      return nameSort(1, a.name, b.name);
    });
  }

  source: LocalDataSource = new LocalDataSource();

  settings = {
    mode: 'external',
    noDataMessage: 'Não encontramos nenhum time para o filtro selecionado.',
    add: {
      addButtonContent: '<i class="nb-plus"></i>',
      createButtonContent: '<i class="nb-checkmark"></i>',
      cancelButtonContent: '<i class="nb-close"></i>',
    },
    edit: {
      editButtonContent: '<i class="nb-edit"></i>',
      saveButtonContent: '<i class="nb-checkmark"></i>',
      cancelButtonContent: '<i class="nb-close"></i>',
    },
    actions: {
      columnTitle: 'Ações',
      add: true,
      edit: true,
      delete: false,
    },
    columns: {
      name: {
        title: 'Nome do time',
        type: 'string',
      },
      sectors: {
        title: 'Setores',
        type: 'string',
        valuePrepareFunction: (sectors: Sector[]) => {
          return sectors
            .map((sector: any) => this.teamService.idToSector(sector).abrev)
            .sort()
            .join(', ');
        },
        filterFunction: (sectors: Sector[], search: string) => {
          return sectors.some((sector) => sector.abrev.includes(search));
        },
        compareFunction: (direction: number, a: Sector[], b: Sector[]): number =>
          nameSort(
            direction,
            a
              .map((sector: any) => this.teamService.idToSector(sector).abrev)
              .sort()
              .join(', '),
            b
              .map((sector: any) => this.teamService.idToSector(sector).abrev)
              .sort()
              .join(', ')
          ),
      },
      leader: {
        title: 'Líder',
        type: 'string',
        valuePrepareFunction: (leader: User | string | undefined) =>
          idToProperty(leader, this.userService.idToUser.bind(this), 'fullName'),
        filterFunction: (leader: User | string | undefined, search?: string): boolean => {
          return leader && search
            ? this.userService.idToUser(leader).fullName.toLowerCase().includes(search.toLowerCase())
            : false;
        },
        compareFunction: (direction: number, a: User | string | undefined, b: User | string | undefined): number =>
          nameSort(
            direction,
            idToProperty(a, this.userService.idToUser.bind(this), 'fullName'),
            idToProperty(b, this.userService.idToUser.bind(this), 'fullName')
          ),
      },
    },
  };

  isPhone = isPhone;

  constructor(
    private dialogService: NbDialogService,
    private userService: UserService,
    public teamService: TeamService
  ) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnInit(): void {
    combineLatest([
      this.teamService.getTeams(),
      this.userService.getUsers(),
      this.teamService.isDataLoaded$,
      this.userService.isDataLoaded$,
    ])
      .pipe(
        skipWhile(([, , teamLoaded, userLoaded]) => !(teamLoaded && userLoaded)),
        takeUntil(this.destroy$)
      )
      .subscribe(([teams, , ,]) => {
        this.teams = teams;
        this.source.load(this.teams);
      });
  }

  openDialog(event: { data?: Team }): void {
    this.dialogService.open(TeamDialogComponent, {
      context: {
        title: event.data ? 'EDIÇÃO DE TIME' : 'CADASTRO DE TIME',
        iTeam: event.data ? event.data : new Team(),
      },
      dialogClass: 'my-dialog',
      closeOnBackdropClick: false,
      closeOnEsc: false,
      autoFocus: false,
    });
  }
}
