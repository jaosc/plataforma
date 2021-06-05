import {
  Component,
  ElementRef,
  EventEmitter,
  Output,
  ViewChild,
} from '@angular/core';

@Component({
  selector: 'ngx-search-input',
  styleUrls: ['./search-input.component.scss'],
  template: `
    <i class="control-icon ion ion-ios-search" (click)="showInput()"></i>
    <input
      placeholder="Type your search request here..."
      #input
      [class.hidden]="!isInputShown"
      (blur)="hideInput()"
      (input)="onInput($event)"
    />
  `,
})
export class SearchInputComponent {
  @ViewChild('input', { static: true }) input!: ElementRef;

  @Output() search: EventEmitter<string> = new EventEmitter<string>();

  isInputShown = false;

  showInput(): void {
    this.isInputShown = true;
    this.input.nativeElement.focus();
  }

  hideInput(): void {
    this.isInputShown = false;
  }

  onInput(val: any): void {
    this.search.emit(val);
  }
}
