/* @flow */

import { makeMap, isBuiltInTag, cached, no } from 'shared/util'

let isStaticKey
let isPlatformReservedTag

const genStaticKeysCached = cached(genStaticKeys)

/**
 * Goal of the optimizer: walk the generated template AST tree
 * and detect sub-trees that are purely static, i.e. parts of
 * the DOM that never needs to change.
 *
 * Once we detect these sub-trees, we can:
 *
 * 1. Hoist them into constants, so that we no longer need to
 *    create fresh nodes for them on each re-render;
 * 2. Completely skip them in the patching process.
 * 
 */
/**
 * 优化阶段其实就干了两件事：
 * 在AST中找出所有静态节点并打上标记；
 * 在AST中找出所有静态根节点并打上标记；
 * 
 * 
 * 在模板编译的时候就先找出模板中所有的静态节点和静态根节点，
 * 然后给它们打上标记，用于告诉后面patch过程打了标记的这些节点是不需要对比的，你只要把它们克隆一份去用就好啦。这就是优化阶段存在的意义。
 * */ 
export function optimize (root: ?ASTElement, options: CompilerOptions) { // 优化阶段
  if (!root) return
  isStaticKey = genStaticKeysCached(options.staticKeys || '')
  isPlatformReservedTag = options.isReservedTag || no // isPlatformReservedTag是否是平台保留的标签，不是组件
  // first pass: mark all non-static nodes.
  // 标记静态节点
  markStatic(root)
  // second pass: mark static roots.
  // 标记静态根节点
  markStaticRoots(root, false)
}

function genStaticKeys (keys: string): Function {
  return makeMap(
    'type,tag,attrsList,attrsMap,plain,parent,children,attrs,start,end,rawAttrsMap' +
    (keys ? ',' + keys : '')
  )
}

function markStatic (node: ASTNode) {
  node.static = isStatic(node) // 该函数若返回true表示该节点是静态节点，若返回false表示该节点不是静态节点
  if (node.type === 1) {
    // do not make component slot content static. this avoids
    // 1. components not able to mutate slot nodes
    // 2. static slot content fails for hot-reloading
    if (
      !isPlatformReservedTag(node.tag) &&
      node.tag !== 'slot' &&
      node.attrsMap['inline-template'] == null
    ) {
      return
    }
    // 递归子节点
    for (let i = 0, l = node.children.length; i < l; i++) {
      const child = node.children[i]
      markStatic(child)
      if (!child.static) { // 当前节点的子节点有一个不是静态节点，那就把当前节点也标记为非静态节点
        node.static = false
      }
    }
    // 如果当前节点的子节点中有标签带有v-if、v-else-if、v-else等指令时
    // 这些子节点在每次渲染时都只渲染一个，所以其余没有被渲染的肯定不在node.children中，
    // 而是存在于node.ifConditions，所以我们还要把node.ifConditions循环一遍，
    if (node.ifConditions) {
      for (let i = 1, l = node.ifConditions.length; i < l; i++) {
        const block = node.ifConditions[i].block
        markStatic(block)
        if (!block.static) {
          node.static = false
        }
      }
    }
  }
}
// v-once 只渲染元素和组件一次，随后的渲染，使用了此指令的元素/组件及其所有的子节点，都会当作静态内容并跳过，这可以用于优化更新性能。
function markStaticRoots (node: ASTNode, isInFor: boolean) {
  if (node.type === 1) { // 是元素节点
    if (node.static || node.once) { // 如果已经是静态节点或者v-once指令的节点
      node.staticInFor = isInFor
    }
    // For a node to qualify as a static root, it should have children that
    // are not just static text. Otherwise the cost of hoisting out will
    // outweigh the benefits and it's better off to just always render it fresh.
    // 根节点本身是静态节点，且要有子节点，并且不能只有一个是纯文本节点的子节点，
    if (node.static && node.children.length && !( 
      node.children.length === 1 &&
      node.children[0].type === 3 // 纯文本节点
    )) {
      node.staticRoot = true
      return
    } else {
      node.staticRoot = false
    }
    if (node.children) {
      for (let i = 0, l = node.children.length; i < l; i++) {
        markStaticRoots(node.children[i], isInFor || !!node.for)
      }
    }
    if (node.ifConditions) {
      for (let i = 1, l = node.ifConditions.length; i < l; i++) {
        markStaticRoots(node.ifConditions[i].block, isInFor)
      }
    }
  }
}

// type取值	对应的AST节点类型
// 1	元素节点
// 2	包含变量的动态文本节点
// 3	不包含变量的纯文本节点
function isStatic (node: ASTNode): boolean { // 该函数若返回true表示该节点是静态节点，若返回false表示该节点不是静态节点
  if (node.type === 2) { // expression 包含变量的动态文本节点
    return false
  }
  if (node.type === 3) { // text 不包含变量的纯文本节点
    return true
  }

  // 当type === 1时
  // 如果绑定了v-pre则是静态节点
  // 否则必须满足
  // 不能使用动态绑定语法，即标签上不能有v-、@、:开头的属性；
  // 不能使用v-if、v-else、v-for指令；
  // 不能是内置组件，即标签名不能是slot和component；
  // 标签名必须是平台保留标签，即不能是组件
  // 当前节点的父节点不能是带有 v-for 的 template 标签
  // 节点的所有属性的 key 都必须是静态节点才有的 key，注：静态节点的key是有限的，它只能是type,tag,attrsList,attrsMap,plain,parent,children,attrs之一；
  return !!(node.pre || ( // type === 1 是元素节点
    !node.hasBindings && // no dynamic bindings 没有动态绑定属性
    !node.if && !node.for && // not v-if or v-for or v-else
    !isBuiltInTag(node.tag) && // not a built-in
    isPlatformReservedTag(node.tag) && // not a component
    !isDirectChildOfTemplateFor(node) &&
    Object.keys(node).every(isStaticKey)
  ))
}

function isDirectChildOfTemplateFor (node: ASTElement): boolean { // 不能是带有v-for的template
  while (node.parent) {
    node = node.parent
    if (node.tag !== 'template') {
      return false
    }
    if (node.for) {
      return true
    }
  }
  return false
}
