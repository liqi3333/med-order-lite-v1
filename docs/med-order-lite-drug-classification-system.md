# med-order-lite 药物分类系统设计稿

> 文件用途：作为 `med-order-lite` 药物分类体系的 Markdown 设计稿。  
> 当前状态：仅为分类设计文档，不修改源代码，不修改 `server/kb/taxonomies/drug-categories.json`。  
> 后续用途：可人工审核后转换为 `drug-categories.json`，用于药物导入页面的一级分类、二级分类下拉菜单。  
> 设计原则：参考 ATC 的“解剖系统 / 治疗用途 / 药理类别”分层思路，同时结合中文临床药物库维护习惯。

---

## 1. 分类设计原则

本分类系统用于药物信息管理、药物检索和候选医嘱生成辅助，不用于自动推荐药物。

### 1.1 分层结构

建议采用三层概念，但当前 App 先使用前两层：

```txt
药物体系 system
  ↓
一级分类 primary_category
  ↓
二级分类 secondary_category
  ↓
三级分类 pharmacologic_class，预留字段
```

当前 `drug.md` 中建议继续使用：

```json
"classification": {
  "system": "western_medicine",
  "primary_category": "anti_infective",
  "secondary_category": "penicillins",
  "pharmacologic_class": "aminopenicillin"
}
```

---

## 2. 药物体系 system

| system 代码 | 中文名称 | 说明 |
|---|---|---|
| `western_medicine` | 化学药品 / 西药 | 常规化学药品，包括多数片剂、胶囊、注射剂等 |
| `biologics` | 生物制品 | 疫苗、血液制品、单克隆抗体、细胞因子、胰岛素类似物等 |
| `chinese_patent_medicine` | 中成药 | 有固定处方、剂型和批准文号的中成药 |
| `traditional_chinese_medicine_decoction_pieces` | 中药饮片 | 中药饮片和配方颗粒，当前版本可暂不启用 |
| `medical_nutrition_and_solutions` | 营养支持 / 溶媒 / 补液 | 肠内营养、肠外营养、基础输液、电解质补充等 |
| `diagnostic_agents` | 诊断用药 / 造影剂 | 造影剂、诊断试剂、检查前用药等 |
| `other` | 其他 | 暂无法归类或院内特殊目录用药 |

---

# 3. 化学药品 / 西药分类

system: `western_medicine`

---

## 3.1 抗感染药

primary_category: `anti_infective`

| 二级代码 | 二级分类 | 说明 / 常见药物举例 |
|---|---|---|
| `penicillins` | 青霉素类 | 青霉素、阿莫西林、氨苄西林、哌拉西林等 |
| `penicillin_beta_lactamase_inhibitor_combinations` | 青霉素类复方 / β-内酰胺酶抑制剂复方 | 阿莫西林克拉维酸、哌拉西林他唑巴坦等 |
| `cephalosporins_first_generation` | 第一代头孢菌素 | 头孢氨苄、头孢唑林等 |
| `cephalosporins_second_generation` | 第二代头孢菌素 | 头孢呋辛等 |
| `cephalosporins_third_generation` | 第三代头孢菌素 | 头孢曲松、头孢噻肟、头孢他啶等 |
| `cephalosporins_fourth_generation` | 第四代头孢菌素 | 头孢吡肟等 |
| `cephalosporins_fifth_generation` | 第五代头孢菌素 | 头孢洛林等 |
| `carbapenems` | 碳青霉烯类 | 美罗培南、亚胺培南西司他丁、厄他培南等 |
| `monobactams` | 单环 β-内酰胺类 | 氨曲南等 |
| `glycopeptides_lipopeptides` | 糖肽类 / 脂肽类 | 万古霉素、替考拉宁、达托霉素等 |
| `aminoglycosides` | 氨基糖苷类 | 庆大霉素、阿米卡星、妥布霉素等 |
| `macrolides` | 大环内酯类 | 阿奇霉素、克拉霉素、红霉素等 |
| `tetracyclines_glycylcyclines` | 四环素类 / 甘氨酰环素类 | 多西环素、米诺环素、替加环素等 |
| `fluoroquinolones` | 氟喹诺酮类 | 左氧氟沙星、莫西沙星、环丙沙星等 |
| `sulfonamides_trimethoprim` | 磺胺类及甲氧苄啶复方 | 复方磺胺甲噁唑等 |
| `nitroimidazoles` | 硝基咪唑类 | 甲硝唑、替硝唑、奥硝唑等 |
| `oxazolidinones` | 噁唑烷酮类 | 利奈唑胺、替地唑胺等 |
| `lincosamides` | 林可酰胺类 | 克林霉素、林可霉素等 |
| `chloramphenicols` | 氯霉素类 | 氯霉素等 |
| `nitrofurans` | 硝基呋喃类 | 呋喃妥因等 |
| `polymyxins` | 多黏菌素类 | 多黏菌素 B、黏菌素等 |
| `rifamycins` | 利福霉素类 | 利福平、利福昔明等 |
| `antituberculosis_drugs` | 抗结核药 | 异烟肼、利福平、乙胺丁醇、吡嗪酰胺等 |
| `antifungal_azoles` | 抗真菌药 - 唑类 | 氟康唑、伏立康唑、伊曲康唑等 |
| `antifungal_echinocandins` | 抗真菌药 - 棘白菌素类 | 卡泊芬净、米卡芬净等 |
| `antifungal_polyenes` | 抗真菌药 - 多烯类 | 两性霉素 B、制霉菌素等 |
| `antiviral_antiherpes` | 抗病毒药 - 抗疱疹病毒 | 阿昔洛韦、伐昔洛韦、更昔洛韦等 |
| `antiviral_antiinfluenza` | 抗病毒药 - 抗流感病毒 | 奥司他韦、扎那米韦、玛巴洛沙韦等 |
| `antiviral_hepatitis` | 抗病毒药 - 肝炎用药 | 恩替卡韦、替诺福韦等 |
| `antiviral_hiv` | 抗病毒药 - HIV 用药 | 拉米夫定、洛匹那韦利托那韦等 |
| `antimicrobial_topical` | 局部抗感染药 | 莫匹罗星、夫西地酸、外用抗真菌药等 |
| `other_antibacterials` | 其他抗菌药 | 磷霉素、夫西地酸、甲氧苄啶等 |

---

## 3.2 抗寄生虫病药

primary_category: `antiparasitic`

| 二级代码 | 二级分类 | 说明 / 常见药物举例 |
|---|---|---|
| `antimalarials` | 抗疟药 | 氯喹、羟氯喹、青蒿素类、伯氨喹等 |
| `antiamebic_antitrichomonal` | 抗阿米巴病 / 抗滴虫药 | 甲硝唑、替硝唑等 |
| `anthelmintics` | 驱肠虫药 | 阿苯达唑、甲苯咪唑、左旋咪唑等 |
| `antischistosomals` | 抗血吸虫药 | 吡喹酮等 |
| `antileishmanial_drugs` | 抗利什曼原虫药 | 葡萄糖酸锑钠等 |
| `ectoparasiticides` | 抗体外寄生虫药 | 伊维菌素、林旦等 |
| `other_antiparasitic_drugs` | 其他抗寄生虫药 | 其他未归类药物 |

---

## 3.3 心血管系统用药

primary_category: `cardiovascular`

| 二级代码 | 二级分类 | 说明 / 常见药物举例 |
|---|---|---|
| `ace_inhibitors` | ACEI | 依那普利、贝那普利、培哚普利等 |
| `angiotensin_receptor_blockers` | ARB | 缬沙坦、氯沙坦、厄贝沙坦等 |
| `angiotensin_receptor_neprilysin_inhibitors` | ARNI | 沙库巴曲缬沙坦等 |
| `beta_blockers` | β 受体阻滞剂 | 美托洛尔、比索洛尔、普萘洛尔等 |
| `calcium_channel_blockers_dihydropyridine` | 二氢吡啶类钙通道阻滞剂 | 氨氯地平、硝苯地平、非洛地平等 |
| `calcium_channel_blockers_nondihydropyridine` | 非二氢吡啶类钙通道阻滞剂 | 维拉帕米、地尔硫䓬等 |
| `diuretics_loop` | 袢利尿剂 | 呋塞米、托拉塞米等 |
| `diuretics_thiazide` | 噻嗪类及类似利尿剂 | 氢氯噻嗪、吲达帕胺等 |
| `diuretics_potassium_sparing` | 保钾利尿剂 | 螺内酯、阿米洛利等 |
| `mineralocorticoid_receptor_antagonists` | 醛固酮受体拮抗剂 | 螺内酯、依普利酮等 |
| `nitrates` | 硝酸酯类 | 硝酸甘油、单硝酸异山梨酯等 |
| `antianginal_other` | 其他抗心绞痛药 | 曲美他嗪、尼可地尔、雷诺嗪等 |
| `antiarrhythmics_class_i` | 抗心律失常药 I 类 | 普罗帕酮、利多卡因等 |
| `antiarrhythmics_class_ii` | 抗心律失常药 II 类 | β 受体阻滞剂类 |
| `antiarrhythmics_class_iii` | 抗心律失常药 III 类 | 胺碘酮、索他洛尔等 |
| `antiarrhythmics_class_iv` | 抗心律失常药 IV 类 | 维拉帕米、地尔硫䓬等 |
| `cardiac_glycosides` | 强心苷类 | 地高辛等 |
| `vasodilators` | 血管扩张药 | 硝普钠、肼屈嗪等 |
| `pulmonary_hypertension_drugs` | 肺动脉高压用药 | 西地那非、波生坦、前列环素类等 |
| `lipid_lowering_statins` | 调脂药 - 他汀类 | 阿托伐他汀、瑞舒伐他汀等 |
| `lipid_lowering_fibrates` | 调脂药 - 贝特类 | 非诺贝特等 |
| `lipid_lowering_other` | 其他调脂药 | 依折麦布、PCSK9 抑制剂等 |
| `heart_failure_sglt2_inhibitors` | 心衰相关 SGLT2 抑制剂 | 达格列净、恩格列净等 |
| `other_cardiovascular_drugs` | 其他心血管药 | 其他未归类心血管药 |

---

## 3.4 血液系统与凝血用药

primary_category: `blood_and_coagulation`

| 二级代码 | 二级分类 | 说明 / 常见药物举例 |
|---|---|---|
| `antiplatelet_drugs` | 抗血小板药 | 阿司匹林、氯吡格雷、替格瑞洛等 |
| `anticoagulants_heparins` | 抗凝药 - 肝素类 | 普通肝素、依诺肝素、那屈肝素等 |
| `anticoagulants_vitamin_k_antagonists` | 抗凝药 - 维生素 K 拮抗剂 | 华法林等 |
| `anticoagulants_doac` | 直接口服抗凝药 | 利伐沙班、阿哌沙班、达比加群等 |
| `thrombolytics` | 溶栓药 | 阿替普酶、尿激酶、链激酶等 |
| `hemostatics` | 止血药 | 氨甲环酸、酚磺乙胺、凝血酶等 |
| `hematopoietic_growth_factors` | 造血生长因子 | 重组人促红素、G-CSF 等 |
| `iron_preparations` | 铁剂 | 硫酸亚铁、蔗糖铁等 |
| `folate_vitamin_b12` | 叶酸 / 维生素 B12 | 叶酸、甲钴胺、氰钴胺等 |
| `plasma_volume_expanders` | 血容量扩充剂 | 人血白蛋白、羟乙基淀粉等 |
| `blood_products` | 血液制品 | 白蛋白、免疫球蛋白、凝血因子等 |
| `other_blood_drugs` | 其他血液系统用药 | 其他未归类药物 |

---

## 3.5 消化系统及代谢用药

primary_category: `digestive_and_metabolism`

| 二级代码 | 二级分类 | 说明 / 常见药物举例 |
|---|---|---|
| `acid_suppressants_ppi` | 抑酸药 - 质子泵抑制剂 | 奥美拉唑、泮托拉唑、艾司奥美拉唑等 |
| `acid_suppressants_h2_blockers` | 抑酸药 - H2 受体阻滞剂 | 法莫替丁、雷尼替丁等 |
| `antacids_mucosal_protectants` | 抗酸药 / 胃黏膜保护剂 | 铝碳酸镁、硫糖铝、胶体果胶铋等 |
| `gastroprokinetics` | 促胃肠动力药 | 多潘立酮、莫沙必利、甲氧氯普胺等 |
| `antiemetics` | 止吐药 | 昂丹司琼、托烷司琼、甲氧氯普胺等 |
| `antidiarrheals` | 止泻药 | 蒙脱石散、洛哌丁胺等 |
| `laxatives` | 泻药 / 通便药 | 乳果糖、聚乙二醇、开塞露等 |
| `intestinal_microecologics` | 肠道微生态制剂 | 双歧杆菌、酪酸梭菌等 |
| `antispasmodics_gi` | 胃肠解痉药 | 山莨菪碱、匹维溴铵等 |
| `hepatoprotective_drugs` | 肝病辅助用药 | 还原型谷胱甘肽、多烯磷脂酰胆碱等 |
| `cholagogues_gallstone_drugs` | 利胆 / 胆石症用药 | 熊去氧胆酸等 |
| `pancreatic_enzyme_preparations` | 胰酶制剂 | 胰酶肠溶制剂等 |
| `ibd_drugs` | 炎症性肠病用药 | 美沙拉嗪、柳氮磺吡啶等 |
| `oral_rehydration_electrolyte_gi` | 口服补液及胃肠电解质 | 口服补液盐等 |
| `other_digestive_drugs` | 其他消化系统用药 | 其他未归类药物 |

---

## 3.6 呼吸系统用药

primary_category: `respiratory`

| 二级代码 | 二级分类 | 说明 / 常见药物举例 |
|---|---|---|
| `bronchodilators_beta2_agonists` | β2 受体激动剂 | 沙丁胺醇、特布他林、福莫特罗等 |
| `bronchodilators_anticholinergics` | 抗胆碱支气管扩张剂 | 异丙托溴铵、噻托溴铵等 |
| `inhaled_corticosteroids` | 吸入糖皮质激素 | 布地奈德、氟替卡松等 |
| `ics_laba_combinations` | ICS / LABA 复方 | 布地奈德福莫特罗、沙美特罗氟替卡松等 |
| `laba_lama_combinations` | LABA / LAMA 复方 | 茚达特罗格隆溴铵等 |
| `leukotriene_receptor_antagonists` | 白三烯受体拮抗剂 | 孟鲁司特等 |
| `mucolytics_expectorants` | 祛痰 / 黏液溶解药 | 氨溴索、乙酰半胱氨酸、羧甲司坦等 |
| `antitussives` | 镇咳药 | 右美沙芬、可待因复方等 |
| `nasal_decongestants` | 鼻减充血剂 | 羟甲唑啉、赛洛唑啉等 |
| `antihistamines_respiratory` | 抗组胺药 | 氯雷他定、西替利嗪、氯苯那敏等 |
| `respiratory_emergency_drugs` | 呼吸急救用药 | 肾上腺素、氨茶碱等 |
| `other_respiratory_drugs` | 其他呼吸系统用药 | 其他未归类药物 |

---

## 3.7 神经系统与精神科用药

primary_category: `nervous_system`

| 二级代码 | 二级分类 | 说明 / 常见药物举例 |
|---|---|---|
| `analgesics_nonopioid` | 非阿片类镇痛药 | 对乙酰氨基酚、布洛芬等 |
| `opioid_analgesics` | 阿片类镇痛药 | 吗啡、羟考酮、芬太尼、曲马多等 |
| `antimigraine_drugs` | 抗偏头痛药 | 舒马普坦、佐米曲普坦等 |
| `antiepileptics` | 抗癫痫药 | 丙戊酸钠、卡马西平、左乙拉西坦等 |
| `antiparkinson_drugs` | 抗帕金森病药 | 左旋多巴、普拉克索、司来吉兰等 |
| `antipsychotics` | 抗精神病药 | 奥氮平、利培酮、喹硫平、氟哌啶醇等 |
| `antidepressants_ssri_snri` | 抗抑郁药 - SSRI / SNRI | 舍曲林、氟西汀、文拉法辛、度洛西汀等 |
| `antidepressants_other` | 其他抗抑郁药 | 米氮平、曲唑酮、阿米替林等 |
| `anxiolytics_hypnotics` | 抗焦虑 / 镇静催眠药 | 地西泮、阿普唑仑、唑吡坦等 |
| `dementia_drugs` | 认知障碍用药 | 多奈哌齐、美金刚等 |
| `neuromuscular_drugs` | 神经肌肉疾病用药 | 巴氯芬、乙哌立松等 |
| `vertigo_drugs` | 眩晕用药 | 倍他司汀、氟桂利嗪等 |
| `other_nervous_system_drugs` | 其他神经系统用药 | 其他未归类药物 |

---

## 3.8 内分泌、代谢及激素类药

primary_category: `endocrine_and_metabolism`

| 二级代码 | 二级分类 | 说明 / 常见药物举例 |
|---|---|---|
| `insulins` | 胰岛素及类似物 | 人胰岛素、甘精胰岛素、门冬胰岛素等 |
| `oral_antidiabetics_biguanides` | 降糖药 - 双胍类 | 二甲双胍等 |
| `oral_antidiabetics_sulfonylureas` | 降糖药 - 磺脲类 | 格列美脲、格列齐特等 |
| `oral_antidiabetics_dpp4_inhibitors` | 降糖药 - DPP-4 抑制剂 | 西格列汀、利格列汀等 |
| `oral_antidiabetics_sglt2_inhibitors` | 降糖药 - SGLT2 抑制剂 | 达格列净、恩格列净等 |
| `glp1_receptor_agonists` | GLP-1 受体激动剂 | 利拉鲁肽、司美格鲁肽等 |
| `thyroid_hormones` | 甲状腺激素类 | 左甲状腺素钠等 |
| `antithyroid_drugs` | 抗甲状腺药 | 甲巯咪唑、丙硫氧嘧啶等 |
| `systemic_corticosteroids` | 全身用糖皮质激素 | 泼尼松、甲泼尼龙、地塞米松等 |
| `adrenal_hormone_related` | 肾上腺相关激素药 | 氢化可的松、氟氢可的松等 |
| `sex_hormones_estrogens_progestins` | 雌激素 / 孕激素类 | 戊酸雌二醇、黄体酮等 |
| `androgens_antiandrogens` | 雄激素 / 抗雄激素药 | 睾酮、比卡鲁胺等 |
| `osteoporosis_drugs` | 骨质疏松用药 | 阿仑膦酸钠、唑来膦酸、钙剂、维生素 D 等 |
| `gout_hyperuricemia_drugs` | 痛风 / 高尿酸血症用药 | 别嘌醇、非布司他、苯溴马隆、秋水仙碱等 |
| `other_endocrine_metabolic_drugs` | 其他内分泌代谢药 | 其他未归类药物 |

---

## 3.9 肌肉骨骼系统与抗炎镇痛药

primary_category: `musculoskeletal_and_antiinflammatory`

| 二级代码 | 二级分类 | 说明 / 常见药物举例 |
|---|---|---|
| `nsaids_nonselective` | 非选择性 NSAIDs | 布洛芬、双氯芬酸、吲哚美辛等 |
| `nsaids_cox2_selective` | COX-2 选择性 NSAIDs | 塞来昔布、依托考昔等 |
| `antirheumatic_dmards` | 传统改善病情抗风湿药 | 甲氨蝶呤、来氟米特、羟氯喹等 |
| `biologic_dmards` | 生物制剂类抗风湿药 | TNF-α 抑制剂、IL 抑制剂等 |
| `muscle_relaxants` | 肌松药 / 骨骼肌松弛药 | 乙哌立松、替扎尼定等 |
| `topical_analgesic_antiinflammatory` | 外用镇痛抗炎药 | 双氯芬酸凝胶、酮洛芬凝胶等 |
| `osteoarthritis_symptomatic_drugs` | 骨关节炎症状改善药 | 氨基葡萄糖等 |
| `other_musculoskeletal_drugs` | 其他肌肉骨骼用药 | 其他未归类药物 |

---

## 3.10 泌尿生殖系统与性激素相关用药

primary_category: `genitourinary_and_sex_hormones`

| 二级代码 | 二级分类 | 说明 / 常见药物举例 |
|---|---|---|
| `bph_drugs_alpha_blockers` | 前列腺增生用药 - α 受体阻滞剂 | 坦索罗辛、多沙唑嗪等 |
| `bph_drugs_5alpha_reductase_inhibitors` | 前列腺增生用药 - 5α 还原酶抑制剂 | 非那雄胺、度他雄胺等 |
| `overactive_bladder_drugs` | 膀胱过度活动症用药 | 托特罗定、索利那新等 |
| `erectile_dysfunction_drugs` | 勃起功能障碍用药 | 西地那非、他达拉非等 |
| `contraceptives` | 避孕药 | 复方口服避孕药、左炔诺孕酮等 |
| `uterotonics` | 子宫收缩药 | 缩宫素、卡前列素等 |
| `tocolytics` | 抑制宫缩药 | 阿托西班、硫酸镁等 |
| `vaginal_antiinfectives` | 阴道抗感染药 | 克霉唑、甲硝唑阴道制剂等 |
| `other_genitourinary_drugs` | 其他泌尿生殖系统用药 | 其他未归类药物 |

---

## 3.11 皮肤科用药

primary_category: `dermatological`

| 二级代码 | 二级分类 | 说明 / 常见药物举例 |
|---|---|---|
| `topical_antibacterials` | 外用抗菌药 | 莫匹罗星、夫西地酸等 |
| `topical_antifungals` | 外用抗真菌药 | 酮康唑、特比萘芬、克霉唑等 |
| `topical_corticosteroids` | 外用糖皮质激素 | 氢化可的松、糠酸莫米松等 |
| `topical_antivirals` | 外用抗病毒药 | 阿昔洛韦乳膏等 |
| `acne_drugs` | 痤疮用药 | 维 A 酸、过氧苯甲酰、阿达帕林等 |
| `psoriasis_drugs` | 银屑病用药 | 卡泊三醇、他卡西醇等 |
| `skin_antiseptics_disinfectants` | 皮肤消毒防腐药 | 碘伏、氯己定等 |
| `wound_care_drugs` | 创面处理用药 | 烧伤膏、创面敷料相关药物等 |
| `other_dermatological_drugs` | 其他皮肤科用药 | 其他未归类药物 |

---

## 3.12 眼科、耳鼻喉及感觉器官用药

primary_category: `sensory_organs`

| 二级代码 | 二级分类 | 说明 / 常见药物举例 |
|---|---|---|
| `ophthalmic_antibiotics` | 眼用抗菌药 | 左氧氟沙星滴眼液、妥布霉素滴眼液等 |
| `ophthalmic_antivirals` | 眼用抗病毒药 | 更昔洛韦眼用凝胶等 |
| `ophthalmic_corticosteroids` | 眼用糖皮质激素 | 氟米龙、妥布霉素地塞米松复方等 |
| `ophthalmic_antiallergics` | 眼用抗过敏药 | 奥洛他定、色甘酸钠等 |
| `glaucoma_drugs` | 青光眼用药 | 拉坦前列素、噻吗洛尔、布林佐胺等 |
| `artificial_tears_lubricants` | 人工泪液 / 眼润滑剂 | 玻璃酸钠滴眼液等 |
| `otic_antiinfectives` | 耳用抗感染药 | 氧氟沙星滴耳液等 |
| `nasal_corticosteroids` | 鼻用糖皮质激素 | 布地奈德鼻喷雾剂、糠酸莫米松鼻喷雾剂等 |
| `ent_other_drugs` | 其他耳鼻喉用药 | 其他未归类药物 |

---

## 3.13 抗肿瘤与免疫调节药

primary_category: `antineoplastic_and_immunomodulating`

| 二级代码 | 二级分类 | 说明 / 常见药物举例 |
|---|---|---|
| `alkylating_agents` | 烷化剂 | 环磷酰胺、异环磷酰胺等 |
| `antimetabolites` | 抗代谢药 | 甲氨蝶呤、氟尿嘧啶、吉西他滨等 |
| `plant_alkaloids_taxanes` | 植物来源抗肿瘤药 / 紫杉类 | 紫杉醇、多西他赛、长春新碱等 |
| `platinum_compounds` | 铂类 | 顺铂、卡铂、奥沙利铂等 |
| `anthracyclines_other_cytotoxics` | 蒽环类及其他细胞毒药 | 多柔比星、表柔比星等 |
| `targeted_therapy_tki` | 靶向治疗 - 酪氨酸激酶抑制剂 | 伊马替尼、吉非替尼、奥希替尼等 |
| `targeted_therapy_monoclonal_antibodies` | 靶向治疗 - 单克隆抗体 | 曲妥珠单抗、贝伐珠单抗、利妥昔单抗等 |
| `immune_checkpoint_inhibitors` | 免疫检查点抑制剂 | PD-1、PD-L1、CTLA-4 抑制剂等 |
| `endocrine_antineoplastic_drugs` | 肿瘤内分泌治疗药 | 他莫昔芬、芳香化酶抑制剂等 |
| `immunosuppressants` | 免疫抑制剂 | 环孢素、他克莫司、吗替麦考酚酯等 |
| `immunostimulants` | 免疫增强剂 | 干扰素、胸腺肽等 |
| `other_antineoplastic_immunomodulating_drugs` | 其他抗肿瘤及免疫调节药 | 其他未归类药物 |

---

## 3.14 麻醉、镇静及围手术期用药

primary_category: `anesthesia_and_perioperative`

| 二级代码 | 二级分类 | 说明 / 常见药物举例 |
|---|---|---|
| `general_anesthetics_inhaled` | 吸入全麻药 | 七氟烷、异氟烷等 |
| `general_anesthetics_intravenous` | 静脉全麻药 | 丙泊酚、依托咪酯、氯胺酮等 |
| `local_anesthetics` | 局部麻醉药 | 利多卡因、罗哌卡因、布比卡因等 |
| `neuromuscular_blockers` | 神经肌肉阻滞药 | 罗库溴铵、顺阿曲库铵等 |
| `neuromuscular_blocker_reversal_agents` | 肌松拮抗药 | 新斯的明、舒更葡糖钠等 |
| `perioperative_sedatives` | 围手术期镇静药 | 咪达唑仑、右美托咪定等 |
| `perioperative_analgesics` | 围手术期镇痛药 | 芬太尼、舒芬太尼、瑞芬太尼等 |
| `other_anesthesia_drugs` | 其他麻醉相关用药 | 其他未归类药物 |

---

## 3.15 急救与危重症用药

primary_category: `emergency_and_critical_care`

| 二级代码 | 二级分类 | 说明 / 常见药物举例 |
|---|---|---|
| `vasopressors_inotropes` | 血管活性药 / 正性肌力药 | 去甲肾上腺素、多巴胺、多巴酚丁胺等 |
| `resuscitation_drugs` | 心肺复苏相关用药 | 肾上腺素、阿托品、碳酸氢钠等 |
| `antidotes` | 解毒药 | 纳洛酮、氟马西尼、乙酰半胱氨酸、阿托品等 |
| `electrolyte_emergency_drugs` | 急诊电解质纠正用药 | 氯化钾、葡萄糖酸钙、硫酸镁等 |
| `critical_care_sedation_analgesia` | ICU 镇静镇痛药 | 丙泊酚、咪达唑仑、右美托咪定、芬太尼等 |
| `critical_care_anticoagulation` | ICU 抗凝相关用药 | 肝素、枸橼酸抗凝相关药物等 |
| `emergency_antihypertensives` | 急症降压药 | 乌拉地尔、硝普钠、尼卡地平等 |
| `emergency_antiallergic_drugs` | 过敏反应急救药 | 肾上腺素、异丙嗪、糖皮质激素等 |
| `other_emergency_drugs` | 其他急救用药 | 其他未归类药物 |

---

## 3.16 营养、电解质、补液与维生素矿物质

primary_category: `nutrition_electrolytes_and_vitamins`

| 二级代码 | 二级分类 | 说明 / 常见药物举例 |
|---|---|---|
| `crystalloids` | 晶体液 / 基础输液 | 0.9% 氯化钠、葡萄糖注射液、乳酸钠林格等 |
| `electrolyte_supplements` | 电解质补充剂 | 氯化钾、氯化钠、葡萄糖酸钙、硫酸镁等 |
| `acid_base_balance_drugs` | 酸碱平衡调节药 | 碳酸氢钠等 |
| `parenteral_nutrition` | 肠外营养药 | 脂肪乳、氨基酸、复方营养制剂等 |
| `enteral_nutrition` | 肠内营养制剂 | 肠内营养混悬液、粉剂等 |
| `vitamins` | 维生素类 | 维生素 B1、B6、C、D 等 |
| `minerals_trace_elements` | 矿物质 / 微量元素 | 钙剂、铁剂、锌剂、复合微量元素等 |
| `other_nutrition_drugs` | 其他营养支持药 | 其他未归类药物 |

---

## 3.17 诊断用药、造影剂及辅助检查用药

primary_category: `diagnostic_and_contrast_agents`

| 二级代码 | 二级分类 | 说明 / 常见药物举例 |
|---|---|---|
| `iodinated_contrast_media` | 碘造影剂 | 碘海醇、碘佛醇、碘普罗胺等 |
| `gadolinium_contrast_media` | 钆类磁共振造影剂 | 钆喷酸葡胺、钆布醇等 |
| `ultrasound_contrast_agents` | 超声造影剂 | 六氟化硫微泡等 |
| `diagnostic_test_agents` | 诊断试验用药 | 结核菌素、促泌素等 |
| `bowel_preparation_agents` | 肠道准备药 | 聚乙二醇电解质散、磷酸钠盐等 |
| `other_diagnostic_agents` | 其他诊断用药 | 其他未归类药物 |

---

# 4. 生物制品分类

system: `biologics`

| 一级代码 | 一级分类 | 二级代码 | 二级分类 |
|---|---|---|---|
| `vaccines` | 疫苗 | `viral_vaccines` | 病毒疫苗 |
| `vaccines` | 疫苗 | `bacterial_vaccines` | 细菌疫苗 |
| `vaccines` | 疫苗 | `combined_vaccines` | 联合疫苗 |
| `blood_products` | 血液制品 | `human_albumin` | 人血白蛋白 |
| `blood_products` | 血液制品 | `immunoglobulins` | 免疫球蛋白 |
| `blood_products` | 血液制品 | `coagulation_factors` | 凝血因子制品 |
| `therapeutic_antibodies` | 治疗性抗体 | `antitumor_monoclonal_antibodies` | 抗肿瘤单克隆抗体 |
| `therapeutic_antibodies` | 治疗性抗体 | `immune_disease_monoclonal_antibodies` | 免疫炎症疾病单克隆抗体 |
| `cytokines_growth_factors` | 细胞因子 / 生长因子 | `interferons` | 干扰素 |
| `cytokines_growth_factors` | 细胞因子 / 生长因子 | `colony_stimulating_factors` | 集落刺激因子 |
| `cytokines_growth_factors` | 细胞因子 / 生长因子 | `erythropoiesis_stimulating_agents` | 促红细胞生成素类 |
| `insulin_biologics` | 胰岛素及类似物 | `human_insulin` | 人胰岛素 |
| `insulin_biologics` | 胰岛素及类似物 | `insulin_analogs` | 胰岛素类似物 |

---

# 5. 中成药分类

system: `chinese_patent_medicine`

> 中成药建议按功能主治和临床系统分类，避免强行套入西药药理分类。

| 一级代码 | 一级分类 | 二级代码 | 二级分类 |
|---|---|---|---|
| `cp_respiratory` | 呼吸系统中成药 | `cp_cough_expectorant` | 止咳化痰 |
| `cp_respiratory` | 呼吸系统中成药 | `cp_cold_fever` | 感冒发热 |
| `cp_respiratory` | 呼吸系统中成药 | `cp_asthma_wheeze` | 平喘 |
| `cp_digestive` | 消化系统中成药 | `cp_stomach_pain` | 胃痛胃胀 |
| `cp_digestive` | 消化系统中成药 | `cp_diarrhea` | 泄泻 |
| `cp_digestive` | 消化系统中成药 | `cp_liver_gallbladder` | 肝胆用药 |
| `cp_cardiovascular` | 心脑血管中成药 | `cp_angina_chest_pain` | 胸痹心痛 |
| `cp_cardiovascular` | 心脑血管中成药 | `cp_stroke_sequelae` | 中风及后遗症 |
| `cp_cardiovascular` | 心脑血管中成药 | `cp_blood_activating` | 活血化瘀 |
| `cp_musculoskeletal` | 骨伤风湿中成药 | `cp_rheumatism_pain` | 风湿痹痛 |
| `cp_musculoskeletal` | 骨伤风湿中成药 | `cp_trauma_injury` | 跌打损伤 |
| `cp_gynecology` | 妇科中成药 | `cp_menstrual_disorders` | 月经不调 |
| `cp_gynecology` | 妇科中成药 | `cp_leukorrhea` | 带下病 |
| `cp_pediatrics` | 儿科中成药 | `cp_pediatric_cold` | 小儿感冒 |
| `cp_pediatrics` | 儿科中成药 | `cp_pediatric_digestive` | 小儿消化 |
| `cp_ent_dermatology` | 五官皮肤中成药 | `cp_throat_oral` | 咽喉口腔 |
| `cp_ent_dermatology` | 五官皮肤中成药 | `cp_skin_itching` | 皮肤瘙痒 |
| `cp_tonic` | 补益类中成药 | `cp_qi_tonifying` | 补气 |
| `cp_tonic` | 补益类中成药 | `cp_blood_tonifying` | 补血 |
| `cp_tonic` | 补益类中成药 | `cp_yin_yang_tonifying` | 补阴补阳 |
| `cp_other` | 其他中成药 | `cp_uncategorized` | 其他未归类 |

---

# 6. 分类代码命名规则

## 6.1 代码格式

建议使用：

```txt
小写英文 + 下划线
```

示例：

```txt
anti_infective
cardiovascular
fluoroquinolones
acid_suppressants_ppi
```

不建议使用：

```txt
中文代码
空格
特殊符号
大小写混用
```

---

## 6.2 primary_category 规则

一级分类应表示大系统或大治疗领域，例如：

```txt
anti_infective
cardiovascular
digestive_and_metabolism
respiratory
nervous_system
```

---

## 6.3 secondary_category 规则

二级分类应表示药理类别、治疗类别或常用药物亚组，例如：

```txt
fluoroquinolones
ace_inhibitors
acid_suppressants_ppi
bronchodilators_beta2_agonists
```

---

## 6.4 pharmacologic_class 规则

三级字段可更细，例如：

```txt
aminopenicillin
third_generation_cephalosporin
dihydropyridine_ccb
proton_pump_inhibitor
```

当前 App 可以先不做下拉，只在 `drug.md` 中作为补充字段。

---

# 7. 推荐 drug.md 中的分类写法

```json
"classification": {
  "system": "western_medicine",
  "primary_category": "anti_infective",
  "secondary_category": "penicillins",
  "pharmacologic_class": "aminopenicillin"
}
```

另一个示例：

```json
"classification": {
  "system": "western_medicine",
  "primary_category": "cardiovascular",
  "secondary_category": "calcium_channel_blockers_dihydropyridine",
  "pharmacologic_class": "dihydropyridine_calcium_channel_blocker"
}
```

中成药示例：

```json
"classification": {
  "system": "chinese_patent_medicine",
  "primary_category": "cp_respiratory",
  "secondary_category": "cp_cough_expectorant",
  "pharmacologic_class": "traditional_function_based"
}
```

---

# 8. 后续转换为 JSON 字典的建议结构

后续如果要转成 `drug-categories.json`，建议结构如下：

```json
{
  "systems": [
    {
      "value": "western_medicine",
      "label": "化学药品 / 西药"
    },
    {
      "value": "biologics",
      "label": "生物制品"
    }
  ],
  "primary_categories": [
    {
      "system": "western_medicine",
      "value": "anti_infective",
      "label": "抗感染药"
    }
  ],
  "secondary_categories": [
    {
      "system": "western_medicine",
      "primary_category": "anti_infective",
      "value": "penicillins",
      "label": "青霉素类"
    }
  ]
}
```

---

# 9. 当前版本建议先启用的核心一级分类

如果不想一次启用全部分类，可以先启用以下 12 个：

```txt
anti_infective
antiparasitic
cardiovascular
blood_and_coagulation
digestive_and_metabolism
respiratory
nervous_system
endocrine_and_metabolism
musculoskeletal_and_antiinflammatory
dermatological
sensory_organs
emergency_and_critical_care
```

---

# 10. 注意事项

1. 本分类体系用于药物库管理，不等同于临床用药推荐。
2. 同一药物可能有多个临床用途，但在当前系统中建议先选择一个主要分类。
3. 如果一个药物跨分类明显，可以在 `aliases` 或未来 `secondary_categories_extra` 中扩展。
4. 高警示、抗菌药物、妊娠风险、肾功能调整等不建议放在分类里，应放在 `risk_tags`。
5. 分类字典变更后，需要重建药物索引。
6. 已入库药物如果更换分类，需要同步修改对应 `drug.md`。
