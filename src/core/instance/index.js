import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'

// 生命周期主要分为四个阶段:
// 1: 初始化阶段: 为Vue实例初始化一些属性，事件以及响应式数据 beforeCreate
// 2: 模板编译阶段: 将模板编译成渲染函数 created
// 3: 挂载阶段： 将实例挂载到指定的Dom上，将模板渲染到真实的Dom中 mount
// 4: 销毁阶段: 将实例自身从父组件中删除, 并取消依赖追踪和事件监听器 destroy
function Vue (options) {
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  this._init(options)
}

initMixin(Vue)
stateMixin(Vue)
eventsMixin(Vue)
lifecycleMixin(Vue)
renderMixin(Vue)

export default Vue
