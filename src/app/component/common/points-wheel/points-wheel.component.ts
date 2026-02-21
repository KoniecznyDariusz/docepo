import { Component, ElementRef, ViewChild, AfterViewInit, effect, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-points-wheel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './points-wheel.component.html',
  styleUrls: ['./points-wheel.component.css']
})
export class PointsWheelComponent implements AfterViewInit {
  value = input(0);
  min = input(0);
  max = input(100);
  valueChange = output<number>();

  @ViewChild('wheel', { static: true }) wheel!: ElementRef<HTMLDivElement>;

  private readonly itemHeight = 60;
  private isViewReady = false;

  constructor() {
    effect(() => {
      const currentValue = this.value();
      this.min();
      this.max();
      if (this.isViewReady) {
        this.scrollToValue(currentValue);
      }
    });
  }

  ngAfterViewInit(): void {
    this.isViewReady = true;
    this.scrollToValue(this.value());
  }

  get options(): number[] {
    const min = this.min();
    const max = this.max();
    const maxPoints = Math.max(min, max);
    const length = maxPoints - min + 1;
    return Array.from({ length }, (_, index) => min + index);
  }

  onScroll(): void {
    const element = this.wheel.nativeElement;
    const index = Math.round(element.scrollTop / this.itemHeight);
    const min = this.min();
    const max = this.max();
    const nextValue = Math.min(Math.max(min + index, min), max);

    if (nextValue !== this.value()) {
      this.valueChange.emit(nextValue);
    }
  }

  private scrollToValue(value: number): void {
    const element = this.wheel.nativeElement;
    const min = this.min();
    const max = this.max();
    const clamped = Math.min(Math.max(value, min), max);
    element.scrollTop = (clamped - min) * this.itemHeight;
  }
}
