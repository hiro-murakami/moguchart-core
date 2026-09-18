import type { App, Plugin } from 'vue'
import { GanttChart } from './GanttChart'

export * from './GanttChart'
export * from '@mogura/moguchart-core'

/**
 * Moguchart の Vue 3 プラグイン。
 * `app.use(MoguchartVue)` で `GanttChart` コンポーネントをグローバル登録します。
 */
export const MoguchartVue: Plugin = {
  install(app: App) {
    app.component('GanttChart', GanttChart)
  },
}

export default MoguchartVue
