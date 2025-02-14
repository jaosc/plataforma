import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CommonTestingModule } from 'app/../common-testing.module';
import { cloneDeep } from 'lodash';
import { Subject, take } from 'rxjs';
import MockedServerSocket from 'socket.io-mock';
import { SocketMock } from 'types/socketio-mock';

import { MessageService } from './message.service';
import { WebSocketService } from './web-socket.service';
import { AuthService } from 'app/auth/auth.service';
import { reviveDates } from 'app/shared/utils';

import { Message } from '@models/message';

describe('MessageService', () => {
  let service: MessageService;
  let httpMock: HttpTestingController;
  let mockedMessages: Message[];
  const socket$ = new Subject<any>();
  const socket: SocketMock = new MockedServerSocket();
  const authServiceSpy = jasmine.createSpyObj<AuthService>('AuthService', ['userEmail'], {
    onUserChange$: new Subject<void>(),
  });
  const socketServiceSpy = jasmine.createSpyObj<WebSocketService>('WebSocketService', ['fromEvent']);
  CommonTestingModule.setUpTestBed();

  beforeEach(() => {
    TestBed.overrideProvider(AuthService, { useValue: authServiceSpy });
    TestBed.overrideProvider(WebSocketService, { useValue: socketServiceSpy });
    authServiceSpy.userEmail.and.returnValue('test1@te.st');
    socketServiceSpy.fromEvent.and.returnValue(socket$);
    httpMock = TestBed.inject(HttpTestingController);
    service = TestBed.inject(MessageService);

    mockedMessages = [];

    const tmpMessage = new Message();
    tmpMessage._id = '0';
    tmpMessage.author = '60213f44ee5fb721209f4ae1';
    tmpMessage.contract = '61e4a44c2357d904a944068c';
    tmpMessage.body = 'teste';
    tmpMessage.created = new Date();

    mockedMessages.push(cloneDeep(tmpMessage));
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('saveMessage should work', (done: DoneFn) => {
    const tmpMessage = new Message();
    tmpMessage._id = '1';
    tmpMessage.author = '60213f44ee5fb721209f4ae1';
    tmpMessage.contract = '61e4a44c2357d904a944068c';
    tmpMessage.body = 'teste2';
    tmpMessage.created = new Date();
    let i = 1;
    const data = {
      ns: {
        coll: 'messages',
      },
      operationType: 'insert',
      fullDocument: tmpMessage,
    };
    socket.socketClient.on('dbchange', (data: any) => socket$.next(data));

    service
      .getMessages()
      .pipe(take(3))
      .subscribe((messages: Message[]) => {
        switch (i) {
          case 1: {
            i += 1;
            expect(messages.length).toBe(0);
            break;
          }
          case 2: {
            i += 1;
            expect(messages.length).toBe(1);
            expect(reviveDates(messages)).toEqual(reviveDates(mockedMessages));
            service.saveMessage(tmpMessage);
            const req = httpMock.expectOne('/api/contract/createMessage/');
            expect(req.request.method).toBe('POST');
            req.flush(null);
            socket.emit('dbchange', data);
            break;
          }
          case 3: {
            expect(messages.length).toBe(2);
            mockedMessages.push(tmpMessage);
            expect(reviveDates(messages)).toEqual(reviveDates(mockedMessages));
            done();
            break;
          }
          default: {
            break;
          }
        }
      });

    const req = httpMock.expectOne('/api/contract/allMessages');
    expect(req.request.method).toBe('POST');
    setTimeout(() => {
      req.flush(mockedMessages);
    }, 50);
  });

  it('getMessages should work', (done: DoneFn) => {
    let i = 1;
    service
      .getMessages()
      .pipe(take(2))
      .subscribe((messages) => {
        switch (i) {
          case 1: {
            i += 1;
            expect(messages.length).toBe(0);
            break;
          }
          case 2: {
            const expectedMessages = reviveDates(mockedMessages);
            expect(messages.length).toBe(1);
            expect(messages).toEqual(expectedMessages);
            done();
            break;
          }
          default: {
            break;
          }
        }
      });

    const req = httpMock.expectOne('/api/contract/allMessages');
    expect(req.request.method).toBe('POST');
    setTimeout(() => {
      req.flush(mockedMessages);
    }, 50);
  });
});
