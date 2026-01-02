/*
 * Copyright (c) 2014-2025 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { TranslateService, TranslateModule } from '@ngx-translate/core'
import { ChallengeService } from '../Services/challenge.service'
import { ConfigurationService } from '../Services/configuration.service'
import { ChangeDetectorRef, Component, NgZone, type OnInit, inject } from '@angular/core'
import { CookieService } from 'ngx-cookie'
import { CountryMappingService } from '../Services/country-mapping.service'
import { SocketIoService } from '../Services/socket-io.service'
import { ClipboardModule } from 'ngx-clipboard'
import { MatIconModule } from '@angular/material/icon'
import { MatButtonModule } from '@angular/material/button'
import { MatCardModule } from '@angular/material/card'
import { LowerCasePipe } from '@angular/common'
import { firstValueFrom } from 'rxjs'
import { Router } from '@angular/router'

interface ChallengeSolvedNotification {
  key: string
  message: string
  flag: string
  country ?: {  code : string ,  name : string  }
  copied : boolean
  codingChallengeId ?: string
  challengeName ?: string
}

@Component({
  selector: 'app-challenge-solved-notification',
  templateUrl: './challenge-solved-notification.component.html',
  styleUrls: ['./challenge-solved-notification.component.scss'],
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, ClipboardModule, TranslateModule, LowerCasePipe]
})
export class ChallengeSolvedNotificationComponent implements OnInit {
  notifications: ChallengeSolvedNotification[] = []
  showCtfFlagsInNotifications = false
  private challengeService = inject(ChallengeService)
  private configurationService = inject(ConfigurationService)
  private ref = inject(ChangeDetectorRef)
  private ngZone = inject(NgZone)
  private socketIoService = inject(SocketIoService)
  private countryMappingService = inject(CountryMappingService)
  private translateService = inject(TranslateService)
  private cookieService = inject(CookieService)
  private router = inject(Router)

  ngOnInit () {
    this.socketIoService.on('challengeSolved', (challenge) => {
      if (challenge && challenge.key) {
        this.ngZone.run(async () => {
          try {
            const solvedChallenge = await firstValueFrom(this.challengeService.getChallenge(challenge.key))
            const challengeComplete = { ...challenge, ...solvedChallenge }
            const countryInfo = this.countryMappingService.map(challengeComplete.country)
            const message = await firstValueFrom(
              this.translateService.get('CHALLENGE_SOLVED', {
                challenge: challengeComplete.name,
                description: challengeComplete.description
              })
            )

            const hasCodingChallenge = challengeComplete.codingChallenge !== undefined && challengeComplete.codingChallenge !== null

            const notification: ChallengeSolvedNotification = {
              key: challenge.key,
              message,
              flag: challenge.flag,
              country: countryInfo,
              copied: false,
              challengeName: challengeComplete.name,
              codingChallengeId: hasCodingChallenge ? challenge.key : undefined
            }

            this.notifications.unshift(notification)
            this.ref.detectChanges()
          } catch (err) {
            console.log(err)
          }
        })
      }
    })

    this.socketIoService.on('notification', (data) => {
      this.ngZone.run(async () => {
        if (data?.message) {
          const notification: ChallengeSolvedNotification = {
            key: Math.random().toString(36).substr(2, 9),
            message: data.message,
            flag: '',
            copied: false
          }
          this.notifications.unshift(notification)
          this.ref.detectChanges()
        }
      })
    })

    this.configurationService.getCtfFlagModeStatus().subscribe((result) => {
      this.showCtfFlagsInNotifications = result
    })
  }

  hasCodingChallenge (notification: ChallengeSolvedNotification): boolean {
    return !!notification.codingChallengeId
  }

  openCodingChallenge (notification: ChallengeSolvedNotification): void {
    this.router.navigate(['/score-board'], {
      queryParams: { codingChallenge: notification.codingChallengeId }
    })
  }

  closeNotification (index: number, shiftKey: boolean) {
    if (shiftKey) {
      this.notifications.splice(0)
    } else {
      this.notifications.splice(index, 1)
    }
  }

  copyToClipboard (text: string) {
    this.cookieService.put('continueCode', text)
  }
}
