import { defineConfig, mergeConfig } from 'vite'
import config from './vite.config.ts'
import { predecessorAuth } from './tests/predecessor-plugin.ts'
export default defineConfig(env => mergeConfig(config(env), { plugins:[predecessorAuth()] }))
