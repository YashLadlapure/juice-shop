/*
 * Copyright (c) 2014-2025 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { TranslateService, TranslateModule } from '@ngx-translate/core'
import { ChallengeService } from '../services/challenge.service'
import { ConfigurationService } from '../services/configuration.service'
import { ChangeDetectorRef, Component, NgZone, type OnInit, Inject } from '@angular/core'
import { CookieService } from 'ngx-cookie-service'
import { CountryMappingService } from '../services/country-mapping.service'
import { SocketIoService } from '../services/socket-io.service'
import { ClipboardModule } from 'ngx-clipboard'
import { MatIconModule } from '@angular/material/icon'
import { MatButtonModule } from '@angular/material/button'
import { MatCardModule } from '@angular/material/card'
import { MatTooltipModule } from '@angular/material/tooltip'
import { LowerCasePipe } from '@angular/common'
import { firstValueFrom } from 'rxjs'
import { Router } from '@angular/router'

interface ChallengeSolvedNotification {
  key: string
  message: string
  flag: string
  copied: false
}

@Component({
  selector: 'app-challenge-solved-notification',
  templateUrl: './challenge-solved-notification.component.html',
  styleUrls: ['./challenge-solved-notification.component.scss'],
  standalone: true,
  imports: [
    TranslateModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatTooltipModule,
    ClipboardModule,
    LowerCasePipe
  ]
})
export class ChallengeSolvedNotificationComponent implements OnInit {
  notifications: ChallengeSolvedNotification[] = []
  showCtfFlagsInNotifications = false
  showCTFCountryDetailsInNotifications = false

  constructor(
    private challengeService: ChallengeService,
    private configurationService: ConfigurationService,
    private ref: ChangeDetectorRef,
    private ngZone: NgZone,
    private socketIoService: SocketIoService,
    private countryMappingService: CountryMappingService,
    private translateService: TranslateService,
    private cookieService: CookieService,
    private router: Router
  ) {}

  ngOnInit() {
    this.socketIoService.on('challengeSolved', (challenge) => {
      this.ngZone.run(async () => {
        try {
          const solvedChallenge = await firstValueFrom(this.challengeService.getChallenge(challenge.key))
          const challengeComplete = { ...challenge, ...solvedChallenge.data }
          const countryInfo = this.countryMappingService.map(challengeComplete.country)
          const notification: ChallengeSolvedNotification = {
            key: challenge.key,
            message: await firstValueFrom(
              this.translateService.get('CHALLENGE_SOLVED', {
                challenge: challengeComplete.name,
                description: challengeComplete.description
              })
            ),
            flag: '',
            copied: false
          }
          this.notifications.unshift(notification)
          this.ref.detectChanges()
        } catch (error) {
          console.error('Error processing challenge:', error)
        }
      })
    })

    this.socketIoService.on('notification', (data) => {
      this.ngZone.run(() => {
        const notification: ChallengeSolvedNotification = {
          key: data.key,
          message: data.message,
          flag: '',
          copied: false
        }
        this.notifications.unshift(notification)
        this.ref.detectChanges()
      })
    })

    this.configurationService.getCtfFlagModeStatus().subscribe((result) => {
      this.showCtfFlagsInNotifications = result
    })

    this.configurationService.getShowCTFCountryDetailsInNotifications().subscribe((countryMode) => {
      this.showCTFCountryDetailsInNotifications = countryMode
    })
  }

  hasCodingChallenge (notification: ChallengeSolvedNotification): boolean {
    return !!notification.key
  }

  openCodingChallenge (notification: ChallengeSolvedNotification): void {
    this.router.navigate(['/score-board'], {
      queryParams: { codingChallenge: notification.key }
    })
  }

  closeNotification (index: number, shiftKey: boolean) {
    if (shiftKey) {
      this.notifications.splice(0)
    } else {
      this.notifications.splice(index, 1)
    }
  }

  copyToClipBoard(text: string) {
    this.cookieService.set('continueCode', text)
  }
}
