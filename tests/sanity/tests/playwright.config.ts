import { PlaywrightTestConfig } from '@playwright/test'
import { config as dotenvConfig } from 'dotenv'
dotenvConfig()

const config: PlaywrightTestConfig = {
  use: {
    screenshot: 'only-on-failure',
    trace: {
      mode: 'retain-on-failure',
      snapshots: true,
      screenshots: true,
      sources: true
    }
  },
  retries: 1,
  timeout: 60000,
  maxFailures: 5,
  expect: {
    timeout: 15000
  },
  reporter: [
    ['list'],
    [
      'allure-playwright',
      {
        detail: true,
        suiteTitle: true
      }
    ]
  ]
}
export default config
