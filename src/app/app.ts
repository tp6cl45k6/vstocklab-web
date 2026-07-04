import { Component } from '@angular/core';
import { DashboardComponent } from './components/dashboard/dashboard';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [DashboardComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App {
  title = 'vstocklab-web';
}
