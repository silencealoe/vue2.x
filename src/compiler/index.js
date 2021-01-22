/* @flow */

import { parse } from './parser/index'
import { optimize } from './optimizer'
import { generate } from './codegen/index'
import { createCompilerCreator } from './create-compiler'

// `createCompilerCreator` allows creating compilers that use alternative
// parser/optimizer/codegen, e.g the SSR optimizing compiler.
// Here we just export a default compiler using the default parts.
// 具体流程：
// 1模板解析阶段： 将一堆模板字符串用正则等方式解析成抽象语法树（AST）
// 2优化阶段: 遍历AST,将其中的静态节点打上标记
// 3代码生成阶段: 将AST转换成渲染函数(render),而render函数会将模板内容生成对应的VNode
export const createCompiler = createCompilerCreator(function baseCompile (
  template: string,
  options: CompilerOptions
): CompiledResult {
   // 模板解析阶段：用正则等方式解析 template 模板中的指令、class、style等数据，形成AST
  const ast = parse(template.trim(), options)
  if (options.optimize !== false) {
    // 优化阶段：遍历AST，找出其中的静态节点，并打上标记；
    // 挡在进行patch 的过程中， DOM-Diff 算法会直接跳过静态节点，从而减少了比较的过程，优化了 patch 的性能
    optimize(ast, options)
  }
   // 代码生成阶段：将AST转换成渲染函数；
  const code = generate(ast, options)
  return {
    ast,
    render: code.render, // 渲染函数
    staticRenderFns: code.staticRenderFns // 静态渲染函数
  }
})
