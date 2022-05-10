import { HttpClient } from '@angular/common/http';
import { Injectable, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { take } from 'rxjs/operators';
import { UserService } from './user.service';
import { TeamMember } from '@models/team';
import { User, UserNotification } from '@models/user';
import { InvoiceTeamMember } from '@models/invoice';
import { UtilsService } from './utils.service';
import { cloneDeep } from 'lodash';

export interface NotificationBody {
  title: string;
  tag: string;
  message: string;
}

export enum NotificationTags {
  MENTION = 'mention',
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService implements OnDestroy {
  private destroy$ = new Subject<void>();

  constructor(private http: HttpClient, private userService: UserService, private utils: UtilsService) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  notify(user: User | string | undefined, body: NotificationBody): void {
    if (user) {
      const notification = new UserNotification();
      notification.title = body.title;
      // notification.tag = body.tag;
      notification.message = body.message;
      notification.to = this.userService.idToUser(user);
      this.userService.currentUser$.pipe(take(1)).subscribe((user) => {
        notification.from = user;
      });
      const req = {
        notification: notification,
      };
      this.http.post('/api/notify/', req).pipe(take(1)).subscribe();
    }
  }

  notifyMany(users: User[] | TeamMember[] | InvoiceTeamMember[], body: NotificationBody): void {
    const notifications: UserNotification[] = [];
    const newNotification = new UserNotification();
    newNotification.title = body.title;
    // newNotification.tag = body.tag;
    newNotification.message = body.message;
    this.userService.currentUser$.pipe(take(1)).subscribe((user) => {
      newNotification.from = user;
    });
    users.forEach((to) => {
      if (this.utils.isOfType<User>(to, ['fullName', 'sectors', 'position'])) newNotification.to = to;
      else newNotification.to = to.user;
      if (newNotification.to) newNotification.to = this.userService.idToUser(newNotification.to);
      notifications.push(cloneDeep(newNotification));
    });

    const req = {
      notifications: notifications,
    };
    this.http.post('/api/notify/many', req).pipe(take(1)).subscribe();
  }

  checkNotification(notification: UserNotification) {
    this.http.post('/api/notify/read', { notification: notification }).pipe(take(1)).subscribe();
  }
}
