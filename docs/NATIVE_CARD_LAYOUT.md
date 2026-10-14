# 原生卡片布局与连续交接

返回 [项目入口](../agent.md)。源码入口是 [app.js](../integrations/native-card/app.js)、[layout.js](../integrations/native-card/layout.js)、[reader.css](../integrations/native-card/reader.css)。

## 所有权

- CSS 拥有阅读控件行、阅读滚动视口和 identity/detail 的稳定网格排版。卡片原有文字、图形、语义 DOM 不复制，也不重排到另一个标题组件
- 外框 spring 只拥有屏幕上的位置、大小、圆角、透明度；不改变内部排版宽度
- layout helper 测量无投影、scroll=0 的原生排版，固定 content canvas 的实际内容宽度。投影是「需要显示的外框内坐标 − 实测原生坐标」
- reader.scrollTop 只拥有用户阅读滚动；关闭前先测量当前显示坐标，再归零滚动并重投影，因此重置没有一次额外跳动
- 内容控制器继续拥有文章、源 slot、焦点、类别、历史与打开/关闭状态。3D 适配器不拥有阅读器的任何几何样式

控件高度由实际 DOM 排版得到，不再同时用 CSS top=64 和 canvas translateY=-64 来互相抵消。原生 CSS 有运行时标记；缺失时停止内容初始化并明确报错，不带着不完整几何悄悄运行。

## 选择、关闭与 resize

选择时保存真实 source identity 矩形；把同一文章借给外框后测量目标排版，再将 identity 投影回 source 矩形。目标排版宽度固定，正常打开/关闭期间文字大小和换行不变。

关闭时同步把同一文章临时放回 slot，应用准备后的原生预览样式，测量返回端点；在浏览器绘制前恢复原 parent/sibling、全部自有样式、阅读滚动和焦点。动画完成只应用这组已测量样式并 reparent，不再额外选择一组新排版。

resize 时先读取实际显示位置，失效并重新测量一次原生排版，再重投影回刚读取的位置，保留 spring 速度并重设目标。返回中更新 slot 屏幕位置；尺寸/排版变化只在 resize 失效路径测量。

## 回归证据

`contentStudy.handoffs()` 保存 source、首次 lifted、最后 airborne、native reparented 以及关闭滚动归零前后的真实矩形。浏览器必须验证：

1. source → 首次 lifted identity 各坐标/尺寸差不超过 1 CSS px
2. 最后 airborne → native identity 各坐标/尺寸差不超过 1 CSS px；旧版本实测 y 跳动 63.994 CSS px
3. 阅读滚动后关闭不因 scrollTop 归零跳动；feed 滚动独立
4. 同卡片打开→关闭→重新打开可逆；返回中 resize 最终进入正确 slot
5. 文字/图形尺寸、同一节点、焦点、history、18 张内容卡片、菜单和聊天仍正常

纯数学/mock 检查不能代表真实 CSS 排版、正常速度动画或 GPU 验收。这里不改变 motion-ball 模块代码、素材或渲染。
