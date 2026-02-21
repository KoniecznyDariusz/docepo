import { Component, Input, Output, EventEmitter, ElementRef, ViewChild, AfterViewInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-points-wheel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './points-wheel.component.html',
  styleUrls: ['./points-wheel.component.css']
})
export class PointsWheelComponent implements AfterViewInit, OnChanges {
  @Input() value = 0;
  @Input() min = 0;
  @Input() max = 100;
  @Output() valueChange = new EventEmitter<number>();

  @ViewChild('wheel', { static: true }) wheel!: ElementRef<HTMLDivElement>;

  private readonly itemHeight = 60;
  private isViewReady = false;

  ngAfterViewInit(): void {
    this.isViewReady = true;
    this.scrollToValue(this.value);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value'] && this.isViewReady) {
      this.scrollToValue(this.value);
    }
  }

  get options(): number[] {
    const maxPoints = Math.max(this.min, this.max);
    const length = maxPoints - this.min + 1;
    return Array.from({ length }, (_, index) => this.min + index);
  }

  onScroll(): void {
    const element = this.wheel.nativeElement;
    const index = Math.round(element.scrollTop / this.itemHeight);
    const nextValue = Math.min(Math.max(this.min + index, this.min), this.max);

    if (nextValue !== this.value) {
      this.value = nextValue;
      this.valueChange.emit(nextValue);
    }
  }

  private scrollToValue(value: number): void {
    const element = this.wheel.nativeElement;
    const clamped = Math.min(Math.max(value, this.min), this.max);
    element.scrollTop = (clamped - this.min) * this.itemHeight;
  }
}
