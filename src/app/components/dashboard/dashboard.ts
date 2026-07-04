import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { AccountService, AccountSummary } from '../../services/account';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss']
})
export class DashboardComponent implements OnInit {
  accountSummary$!: Observable<AccountSummary>;

  constructor(private accountService: AccountService) {}

  ngOnInit(): void {
    this.fetchAccountData();
  }

  fetchAccountData(): void {
    this.accountSummary$ = this.accountService.getAccountSummary();
  }
}
