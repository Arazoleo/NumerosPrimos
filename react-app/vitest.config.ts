import { configDefaults, defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.js'

export default defineConfig(environment => mergeConfig(viteConfig(environment), {
  test: { exclude: [...configDefaults.exclude, 'e2e/**'] },
}))
