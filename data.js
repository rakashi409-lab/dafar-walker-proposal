window.PROPOSAL_DATA = {
  gallery: [
    {id:'walk-front',src:'assets/render-11.webp',full:'assets/render-11.webp',viewer:'assets/viewer-11.webp',title:'随行助行 · 正面视角',description:'储物布袋与助行结构相结合，满足出行时的置物需求。',kicker:'WALK'},
    {id:'walk-rear',src:'assets/render-10.webp',full:'assets/render-10.webp',viewer:'assets/viewer-10.webp',title:'随行助行 · 背侧视角',description:'从背侧观察扶持姿态，以及人体与管架的相对关系。',kicker:'WALK'},
    {id:'sit-front',src:'assets/render-13.webp',full:'assets/render-13.webp',viewer:'assets/viewer-13.webp',title:'休憩安坐 · 正面视角',description:'展开坐垫与靠背，配合伸缩扶手，提供即时休憩支撑。',kicker:'REST'},
    {id:'sit-rear',src:'assets/render-12.webp',full:'assets/render-12.webp',viewer:'assets/viewer-12.webp',title:'休憩安坐 · 背侧视角',description:'观察展开后的靠背、座架及其结构连接。',kicker:'REST'},
    {id:'store-front',src:'assets/render-14.webp',full:'assets/render-14.webp',viewer:'assets/viewer-14.webp',title:'简约收纳 · 前侧视角',description:'通过整体对叠，缩减收纳时的占用空间。',kicker:'FOLD'},
    {id:'store-rear',src:'assets/render-15.webp',full:'assets/render-15.webp',viewer:'assets/viewer-15.webp',title:'简约收纳 · 后侧视角',description:'从另一侧观察扶手与管架收合后的相对位置。',kicker:'FOLD'},
    {id:'three-front',src:'assets/render-16.webp',full:'assets/render-16.webp',viewer:'assets/viewer-16.webp',title:'三种形态 · 正面总览',description:'对比同一产品在助行、安坐与收纳时的整体姿态。',kicker:'OVERVIEW'},
    {id:'three-side',src:'assets/render-17.webp',full:'assets/render-17.webp',viewer:'assets/viewer-17.webp',title:'三种形态 · 侧面总览',description:'从侧面观察功能转换前后的结构与空间变化。',kicker:'OVERVIEW'},
    {id:'overview',src:'assets/render-03.webp',full:'assets/render-03.webp',viewer:'assets/form-03.webp',title:'一个设计，三种形态',description:'随行助行、休憩安坐、简约收纳，在同一件产品中满足不同的日常需要。',kicker:'CONCEPT'},
    {id:'walk-form',src:'assets/form-04.webp',full:'assets/render-04.webp',viewer:'assets/form-04.webp',title:'随行助行 · 产品形态',description:'助行形态配备便携储物布袋，兼顾自主行走与随身置物。',kicker:'FORM 01'},
    {id:'sit-form',src:'assets/form-05.webp',full:'assets/render-05.webp',viewer:'assets/form-05.webp',title:'休憩安坐 · 产品形态',description:'坐垫、可折叠靠背与伸缩扶手共同组成休憩支撑。',kicker:'FORM 02'},
    {id:'frame-form',src:'assets/form-06.webp',full:'assets/render-06.webp',viewer:'assets/form-06.webp',title:'形态转换 · 水平展开',description:'底座上方部件处于水平状态，展示形态转换中的结构关系。',kicker:'TRANSFORMATION'},
    {id:'fold-form',src:'assets/form-07.webp',full:'assets/render-07.webp',viewer:'assets/form-07.webp',title:'形态转换 · 扶手外旋',description:'扶手向外旋转至与下方管架平行，为整体收合做好准备。',kicker:'TRANSFORMATION'},
    {id:'store-form',src:'assets/form-08.webp',full:'assets/render-08.webp',viewer:'assets/form-08.webp',title:'简约收纳 · 收合形态',description:'两侧向内挤压收缩，完成结构对叠，缩减占用空间。',kicker:'FORM 03'}
  ],
  modes: [
    {title:'随行助行',en:'WALK',description:'辅助自主行走，让日常出行多一份支撑。便携储物布袋随身携带，照顾行走途中置物的需要。',detail:'助行支撑 / 便携储物布袋',assetId:'walk-form'},
    {title:'休憩安坐',en:'REST',description:'需要停留时，展开坐垫与可折叠靠背，调节伸缩扶手。让行走途中的休息，有一处随时可用的支撑。',detail:'坐垫与折叠靠背 / 伸缩扶手',assetId:'sit-form'},
    {title:'简约收纳',en:'FOLD',description:'将靠背、扶手与两侧管架依次收合，完成整体对叠。以更紧凑的形态，减少闲置时的空间占用。',detail:'整体对叠结构 / 紧凑收纳',assetId:'store-form'}
  ],
  transitions: [
    {title:'随行助行 → 休憩安坐',steps:[
      {title:'取袋，翻转座架',description:'取下布袋，将底座上方部件顺时针旋转至水平状态。',assetId:'frame-form'},
      {title:'展开靠背与扶手',description:'靠背逆时针旋转至竖直状态，扶手向上抽出。',assetId:'sit-form'},
      {title:'完成休憩形态',description:'坐垫、靠背与扶手形成休憩支撑，呈现安坐时的人机关系。',assetId:'sit-front'}
    ]},
    {title:'休憩安坐 → 简约收纳',steps:[
      {title:'放平靠背，收回扶手',description:'靠背顺时针旋转至水平状态，扶手向下收缩。',assetId:'frame-form'},
      {title:'向外旋转扶手',description:'扶手向外旋转，直至与下方管架平行。',assetId:'fold-form'},
      {title:'向内收合',description:'两侧向内挤压收缩，完成简约收纳形态。',assetId:'store-form'}
    ]},
    {title:'随行助行 → 简约收纳',steps:[
      {title:'取袋，翻转座架',description:'取下布袋，将底座上方部件顺时针旋转至水平状态。',assetId:'frame-form'},
      {title:'向外旋转扶手',description:'扶手向外旋转，直至与下方管架平行。',assetId:'fold-form'},
      {title:'向内收合',description:'两侧向内挤压收缩，完成整体折叠。',assetId:'store-form'}
    ]}
  ]
};
