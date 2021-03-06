/* @flow */
// 响应式原理
// 初始化时，Oberver给data中的每一个属性都通过Object.definePropoty()转换成getter/setter来追踪数据变化
// 当读取这个属性时,会触发getter给读取的数据添加（dep）一个依赖（watcher）
// 当修改属性值时， 会触发setter 向dep中的依赖（watcher）发送通知（dep.notify()）,watcher收到通知后，触发视图更新操作

//数组
// 遍历数组的每一项，给每一项添加响应式， 通过拦截数组的原型方法（改变数组自身的方法）来观测数组的变化

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject, // 是否是纯对象
  isPrimitive, // 是否是原始值
  isUndef, // 是否是undefined?
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods) // 属性名称的数组(数组的方法名字)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true // 是否应该被观察

export function toggleObserving (value: boolean) {
  shouldObserve = value
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */
// 附加到每个被观察对象的观察者类。附加后，观察者将目标对象的属性键转换为getter/setter，收集依赖项并发送更新。
// Observer（）遍历数组中的每一个元素及深度遍历对象的每一个元素，给他们添加getter/setter
export class Observer {
  value: any;
  dep: Dep;
  vmCount: number; // number of vms that have this object as root $data该实例被调用次数（组件的使用次数）

  constructor (value: any) {
    this.value = value
    this.dep = new Dep() // 用来收集数组依赖
    this.vmCount = 0
    // def() 给对象添加属性及属性描述符
    def(value, '__ob__', this) // 给value加上_ob_属性，值为value的Observer实例，表示value已经被转为响应式
    if (Array.isArray(value)) { // 是数组时的响应式处理
      if (hasProto) { // 是否可以使用__proto__ 浏览器兼容
        protoAugment(value, arrayMethods) // // 通过使用__proto__拦截原型链来强化一个目标对象或者数组
      } else { // 如果不能使用__proto__
        // 通过定义隐藏属性来强化目标对象或者数组
        // arrayMethods = Array.prototype arrayKeys数组的所有属性名称
        copyAugment(value, arrayMethods, arrayKeys)
      }
      this.observeArray(value) // 深度监听数组
    } else {
      this.walk(value) // 当value是object时
    }
  }

  /**
   * Walk through all properties and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   */
  // 遍历所有属性并将它们转换为getter/setter（响应式属性）
  // 对象时（响应式属性）
  walk (obj: Object) {
    const keys = Object.keys(obj) // 对象的所有属性
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i]) // 给所有对象添加响应
    }
  }

  /**
   * Observe a list of Array items.
   */
  // 数组时
  observeArray (items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}

// helpers

/**
 * Augment a target Object or Array by intercepting
 * the prototype chain using __proto__
 */
// 通过使用__proto__拦截原型链来强化一个目标对象或者数组
function protoAugment (target, src: Object) {
  /* eslint-disable no-proto */
  target.__proto__ = src // arr._proto_ = Array.prototype
  /* eslint-enable no-proto */
}

/**
 * Augment a target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
function copyAugment (target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i] // push, pop...
    def(target, key, src[key]) // arr.push = Array.prototype.push
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */
// 尝试为一个值创建一个观察者实例，如果观察成功，返回新的观察者，如果值已经有一个观察者，则返回现有的观察者。                                                          
export function observe (value: any, asRootData: ?boolean): ObserverObserver | void {
  if (!isObject(value) || value instanceof VNode) { // 不是对象或者是虚拟节点？
    return
  }
  let ob: Observer | void
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) { // 如果存在_ob_属性，则已经被转换为响应式了
    ob = value.__ob__
  } else if (
    shouldObserve &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) {
    ob = new Observer(value)
  }
  if (asRootData && ob) {
    ob.vmCount++
  }
  return ob
}

/**
 * Define a reactive property on an Object.
 */
// 给对象定义响应式属性
export function defineReactive (
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean
) {
  const dep = new Dep()
  // Object.getOwnPropertyDescriptor(对象，对象中的属性) 方法返回指定对象上一个自有属性对应的属性描述符。（自有属性指的是直接赋予该对象的属性，不需要从原型链上进行查找的属性）
  const property = Object.getOwnPropertyDescriptor(obj, key)
  if (property && property.configurable === false) { // 如果不可配置就停止
    return
  }

  // cater for pre-defined getter/setters
  const getter = property && property.get
  const setter = property && property.set
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key]
  }

  let childOb = !shallow && observe(val) // 如果不隐藏，就观察val
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter () {
      const value = getter ? getter.call(obj) : val
      if (Dep.target) { // !target表示是否添加依赖,这里表示未添加依赖
        dep.depend() // 添加依赖
        if (childOb) {
          childOb.dep.depend() // 添加依赖 这里的dep是Observer中的
          if (Array.isArray(value)) {
            dependArray(value)
          }
        }
      }
      return value
    },
    set: function reactiveSetter (newVal) {
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
      // 考虑到 NaN === NaN 情况
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      // #7981: for accessor properties without setter
      if (getter && !setter) return
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      childOb = !shallow && observe(newVal)
      dep.notify()
    }
  })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
// 设置对象的属性。添加新属性并在属性不存在时触发更改通知。 $set
export function set (target: Array<any> | Object, key: any, val: any): any {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key)
    target.splice(key, 1, val) // 替换数组中的值
    return val
  }
  if (key in target && !(key in Object.prototype)) { // 改变对象的属性值
    target[key] = val
    return val
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  if (!ob) {
    target[key] = val
    return val
  }
  defineReactive(ob.value, key, val)
  ob.dep.notify() //  通知watcher更新
  return val
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del (target: Array<any> | Object, key: any) { 
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  if (!hasOwn(target, key)) {
    return
  }
  delete target[key]
  if (!ob) {
    return
  }
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
// 在接触数组时收集对数组元素的依赖关系，因为我们不能像属性getter那样拦截数组元素访问。
function dependArray (value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    e && e.__ob__ && e.__ob__.dep.depend()
    if (Array.isArray(e)) {
      dependArray(e)
    }
  }
}
