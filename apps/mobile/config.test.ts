/// <reference types="node" />

import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ExpoConfig } from 'expo/config'
import createConfig from './app.config'
import appJson from './app.json'
import easJson from './eas.json'

const configEnvKeys = [
  'APP_VARIANT',
  'EXPO_PUBLIC_API_URL',
  'EAS_BUILD_PROFILE',
  'EAS_PROJECT_ID',
  'EXPO_OWNER',
] as const

type ConfigEnv = Partial<Record<(typeof configEnvKeys)[number], string>>

function resolveConfig(env: ConfigEnv) {
  const previous = Object.fromEntries(configEnvKeys.map(key => [key, process.env[key]]))
  try {
    // Load only the supplied build environment, without developer .env values.
    for (const key of configEnvKeys) {
      if (env[key] === undefined) delete process.env[key]
      else process.env[key] = env[key]
    }
    return createConfig({
      config: structuredClone(appJson.expo) as ExpoConfig,
      projectRoot: process.cwd(),
      staticConfigPath: null,
      packageJsonPath: null,
    })
  } finally {
    for (const key of configEnvKeys) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
  }
}

const qaEnv = { ...easJson.build.qa.env, EAS_BUILD_PROFILE: 'qa' }

test('the committed QA profile resolves the standalone staging app without local environment files', () => {
  const config = resolveConfig(qaEnv)
  assert.equal(config.android?.package, 'com.datememe.app.staging')
  assert.equal(config.name, 'Datememe QA')
  assert.equal(config.extra?.appVariant, 'staging')
  assert.equal(config.extra?.apiUrl, 'https://qa-server-staging.up.railway.app')
  assert.equal(config.owner, appJson.expo.owner)
  assert.equal(config.extra?.eas?.projectId, appJson.expo.extra.eas.projectId)
  assert.equal(easJson.build.qa.android.buildType, 'apk')
  assert.equal(easJson.build.qa.developmentClient, false)
})

for (const endpoint of ['https://datememe-server.up.railway.app', 'http://localhost:3002']) {
  test(`QA rejects an endpoint outside staging: ${endpoint}`, () => {
    assert.throws(
      () => resolveConfig({ ...qaEnv, EXPO_PUBLIC_API_URL: endpoint }),
      /Staging builds must use exactly/,
    )
  })
}

test('QA rejects a missing endpoint', () => {
  assert.throws(
    () => resolveConfig({ APP_VARIANT: 'staging', EAS_BUILD_PROFILE: 'qa' }),
    /EXPO_PUBLIC_API_URL is required/,
  )
})

test('QA rejects an unknown app variant', () => {
  assert.throws(
    () => resolveConfig({ ...qaEnv, APP_VARIANT: 'stagng' }),
    /Unknown APP_VARIANT/,
  )
})

test('QA rejects the production variant even with an approved endpoint', () => {
  assert.throws(
    () => resolveConfig({ ...qaEnv, APP_VARIANT: 'production' }),
    /Only the staging qa EAS build profile/,
  )
})

test('local development uses the explicit developer API and its own package', () => {
  const config = resolveConfig({ EXPO_PUBLIC_API_URL: 'http://10.0.2.2:3002' })
  assert.equal(config.android?.package, 'com.datememe.app.dev')
  assert.equal(config.name, 'Datememe Dev')
  assert.equal(config.extra?.appVariant, 'development')
  assert.equal(config.extra?.apiUrl, 'http://10.0.2.2:3002')
})
