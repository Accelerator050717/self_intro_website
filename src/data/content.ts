import { siteContact } from './site-config';

export type Lang = 'en' | 'zh';

export type Project = {
  slug: string;
  categories: ('ai' | 'software' | 'experiments')[];
  tech: string[];
  color: string;
  title: Record<Lang, string>;
  shortTitle: Record<Lang, string>;
  description: Record<Lang, string>;
  status: Record<Lang, string>;
  kind: Record<Lang, string>;
  sections: Record<Lang, { title: string; paragraphs: string[] }[]>;
  workflow: Record<Lang, string[]>;
};

export const profile = {
  name: { en: 'Mingyang Yu', zh: '余明阳' },
  email: siteContact.email,
  github: siteContact.github,
};

export const experiences = [
  {
    year: '2026',
    company: { en: 'Baheal Pharma Group', zh: '百洋医药集团' },
    role: { en: 'Intern', zh: '实习' },
    description: {
      en: 'Developed and iterated a complete WeChat mini-program client, integrated applied AI, and worked on frontend modernization, backend integration, and data consistency.',
      zh: '承担完整微信小程序客户端的开发与迭代，参与应用 AI 集成、既有系统前端重构、后端联调与数据一致性处理。',
    },
  },
  {
    year: '2025',
    company: { en: 'Baidu / Xiaodu', zh: '百度 / 小度' },
    role: { en: 'Intern', zh: '实习' },
    description: {
      en: 'Worked on automation, data pipelines, experiment tooling, and system validation.',
      zh: '参与自动化、数据管线、实验工具与系统验证相关工作。',
    },
  },
];

export const aboutCopy: Record<Lang, string[]> = {
  en: [
    'I’m Mingyang, an undergraduate studying Computer Science at the University of California, Irvine. I like moving between ideas and implementation: figuring out what a system should do, connecting its pieces, and testing where it breaks.',
    'My interests span applied AI, software systems, and small interactive worlds. Internship work has brought me into automation, data pipelines, application integration, and the practical details of building a complete client. I’m interested in how these pieces fit together, especially when a system has to work with existing data and interfaces.',
    'Some projects are practical; others start with a simple question: would this be fun to build? GoldenCamp leaves room for that side of my work.',
  ],
  zh: [
    '我是余明阳，就读于加州大学欧文分校计算机科学本科。我喜欢在想法和实现之间来回走：先想清楚系统应该做什么，再把各个部分接起来，看看它会在哪里出问题。',
    '我的兴趣包括应用 AI、软件系统，以及小型互动世界。实习中，我接触了自动化、数据管线、应用集成，也承担过完整客户端的开发。我尤其在意这些部分如何协同，以及软件如何与已有的数据和接口一起工作。',
    '有些项目解决实际问题，有些则从一句“做出来会不会很好玩？”开始。四人淘金营地就是我给这份好奇心留出的空间。',
  ],
};

export const projects: Project[] = [
  {
    slug: 'goldencamp',
    categories: ['experiments'],
    tech: ['Unity', 'C#'],
    color: '#B5DBE9',
    title: { en: 'GoldenCamp', zh: '四人淘金营地' },
    shortTitle: { en: 'GoldenCamp', zh: '四人淘金营地' },
    description: {
      en: 'A four-player gold-mining prototype exploring cooperation, private discoveries, and playful betrayal.',
      zh: '一个面向最多四人的合作淘金游戏原型，探索私下发现、共同建设，以及合作中的利益冲突。',
    },
    status: { en: 'In development', zh: '开发中原型' },
    kind: { en: 'Game development', zh: '游戏开发' },
    sections: {
      en: [
        {
          title: 'Overview',
          paragraphs: [
            'GoldenCamp is a cooperative gold-mining game prototype for up to four players. Its central idea is that sharing a camp does not have to mean sharing every discovery or every asset. Mining creates reasons to work together, while private information and individual ownership create room for disagreement, negotiation, and playful betrayal.',
            'The game’s direction includes discovering mining spots in private, transporting resources, trading, stealing, and returning to a persistent camp. Together, these ideas explore how players might balance a common goal with their own interests.',
          ],
        },
        {
          title: 'My contribution',
          paragraphs: [
            'I’m developing the prototype in Unity and C#, working through the relationship between mining, the camp, and independent assets. The project gives me a place to explore software through a small interactive world, where a rule matters because of the choices it makes possible for players.',
          ],
        },
        {
          title: 'Game loop',
          paragraphs: [
            'The concept follows a discovery from the mine back to camp: find a resource, decide what to reveal, move it, then choose how to use or exchange it. Each step creates a different opportunity to cooperate or keep something to yourself. The diagram sketches this intended loop.',
          ],
        },
        {
          title: 'Design focus',
          paragraphs: [
            'The interesting tension is between a shared place and separate interests. Design questions include what information remains private, what players can own independently, and how a persistent camp gives individual decisions consequences beyond a single trip. Trading and stealing are ways to explore those relationships through play.',
          ],
        },
        {
          title: 'Status & scope',
          paragraphs: [
            'GoldenCamp is an in-development prototype; the mechanics described here are design directions still being explored. Online multiplayer validation remains outside this showcase.',
          ],
        },
      ],
      zh: [
        {
          title: '项目概览',
          paragraphs: [
            '四人淘金营地是一个面向最多四人的合作淘金游戏原型。它的出发点是：共享一个营地，不意味着必须公开每一次发现，也不意味着所有资产都归集体所有。采矿让玩家有理由合作，私人信息与独立资产则为协商、冲突和有趣的背叛留下空间。',
            '目前的玩法方向包括私下发现矿点、资源搬运、交易、抢夺和持久营地。这些想法共同探索一个问题：玩家会如何平衡共同目标与自己的利益？',
          ],
        },
        {
          title: '我的工作',
          paragraphs: [
            '我使用 Unity 和 C# 开发这个原型，围绕采矿、营地与独立资产之间的关系推进设计和实现。这个项目让我能在一个小型互动世界里探索软件：一条规则的意义，来自它能为玩家带来怎样的选择。',
          ],
        },
        {
          title: '玩法流程',
          paragraphs: [
            '概念流程从矿点出发，最终回到营地：发现资源、决定透露多少信息、完成搬运，再选择如何使用或交换。每一步都为合作或保留自己的发现创造不同的机会，流程图展示的就是这个预期循环。',
          ],
        },
        {
          title: '设计关注点',
          paragraphs: [
            '项目最有意思的张力，在于共同生活的空间与各自不同的利益。哪些信息应该保持私密？哪些资产可以独立拥有？持久营地如何让一次决定影响后续行动？交易和抢夺，就是通过游玩探索这些关系的方式。',
          ],
        },
        {
          title: '阶段与范围',
          paragraphs: [
            '项目仍处于原型开发阶段，所述机制是仍在探索的设计方向；本页不代表已完成线上多人验收。',
          ],
        },
      ],
    },
    workflow: {
      en: ['Discover a mining spot', 'Choose what to share', 'Transport resources', 'Trade or keep', 'Return to camp'],
      zh: ['发现矿点', '决定分享的信息', '搬运资源', '交易或保留', '返回营地'],
    },
  },
  {
    slug: 'context-ai',
    categories: ['ai'],
    tech: ['Coze Workflow', 'Agent', 'TypeScript'],
    color: '#C8D6F0',
    title: { en: 'Context-aware AI Assistant', zh: '上下文共享 AI 助手' },
    shortTitle: { en: 'Context-aware AI', zh: '上下文共享 AI' },
    description: {
      en: 'Connecting structured summaries and follow-up questions through shared, carefully scoped context.',
      zh: '把结构化摘要与后续问答连接起来，让上下文可以共享，同时保留清楚的患者与问诊边界。',
    },
    status: { en: 'Internship project', zh: '实习项目' },
    kind: { en: 'Applied AI integration', zh: '应用 AI 集成' },
    sections: {
      en: [
        {
          title: 'Overview',
          paragraphs: [
            'This application integration project connects history summaries and follow-up questions within DoctorAppDemo. A useful follow-up conversation needs access to the relevant information behind a summary. At the same time, that context must stay within the correct patient and consultation boundaries, and missing information must remain visible as missing.',
            'The project uses Coze Workflow, an Agent, TypeScript, and a Gateway as parts of the application flow. Structured source information connects these pieces, giving the summary and the conversation a shared basis.',
          ],
        },
        {
          title: 'My contribution',
          paragraphs: [
            'My work covers integrating the history-summary and follow-up-question flows. The focus is on passing structured information, sharing the appropriate context between those flows, and keeping the patient and consultation scope explicit. Handling absent information belongs to that integration work, alongside getting the application components to communicate.',
          ],
        },
        {
          title: 'System flow',
          paragraphs: [
            'The workflow starts with structured information, carries it into a scoped context, and connects a summary with subsequent questions. A follow-up question can then be considered alongside the information relevant to that consultation. The diagram shows these application relationships at a high level.',
          ],
        },
        {
          title: 'Engineering focus',
          paragraphs: [
            'Context sharing is useful only when its boundaries are clear. Important design concerns include keeping one consultation’s information separate from another and making gaps in the source material understandable. A response should preserve that uncertainty: a missing value is not a normal finding, and a concise summary should not conceal what the source leaves unknown.',
          ],
        },
        {
          title: 'Status & scope',
          paragraphs: [
            'This internship project focuses on application integration. Functional checks with limited source material do not establish clinical summary quality. It makes no claim of diagnostic ability or demonstrated clinical effectiveness.',
          ],
        },
      ],
      zh: [
        {
          title: '项目概览',
          paragraphs: [
            '这个项目在 DoctorAppDemo 中集成病史摘要与后续问答。后续对话需要使用摘要背后的相关资料，同时，这些上下文必须属于正确的患者与问诊，缺失的信息也需要被明确保留为缺失。',
            '应用流程涉及 Coze Workflow、Agent、TypeScript 和 Gateway。结构化来源资料把这些组件连接起来，为摘要和后续对话提供共同依据。',
          ],
        },
        {
          title: '我的工作',
          paragraphs: [
            '我的工作覆盖病史摘要与后续问答流程的集成，重点是传递结构化信息、在两段流程之间共享合适的上下文，并明确患者和问诊的作用范围。除了让应用组件能够通信，缺失资料如何被提示也是集成的一部分。',
          ],
        },
        {
          title: '系统流程',
          paragraphs: [
            '流程从结构化资料开始，将其纳入有明确范围的上下文，再连接摘要与后续问题。这样，后续问题可以与本次问诊相关的信息一起被处理。示意图展示了这些应用层面的关系。',
          ],
        },
        {
          title: '工程关注点',
          paragraphs: [
            '上下文共享的前提是边界清楚。设计需要关注不同问诊的信息隔离，也要让使用者理解来源资料的缺口。回答需要保留这种不确定性：缺失不等于正常，简洁的摘要也不应掩盖来源资料中尚不清楚的部分。',
          ],
        },
        {
          title: '阶段与范围',
          paragraphs: [
            '这是一个聚焦应用集成的实习项目。有限资料下的功能检查不等于临床摘要质量验收；项目不宣称具备诊断能力或已经证明临床有效性。',
          ],
        },
      ],
    },
    workflow: {
      en: ['Structured information', 'Scoped shared context', 'History summary', 'Follow-up questions'],
      zh: ['结构化资料', '限定范围的共享上下文', '病史摘要', '后续问答'],
    },
  },
  {
    slug: 'yunxinyi',
    categories: ['software'],
    tech: ['WeChat Mini Program', 'TypeScript', 'Backend API integration'],
    color: '#C2E2DF',
    title: { en: 'Yunxinyi WeChat Mini Program', zh: '云心医微信小程序' },
    shortTitle: { en: 'Yunxinyi', zh: '云心医' },
    description: {
      en: 'Building and iterating a complete patient-facing mini-program client, from authentication to records and reports.',
      zh: '承担完整微信小程序客户端的开发与迭代，连接认证、测量记录、报告访问与界面流程。',
    },
    status: { en: 'Internship project', zh: '实习项目' },
    kind: { en: 'Client development', zh: '客户端开发' },
    sections: {
      en: [
        {
          title: 'Overview',
          paragraphs: [
            'Yunxinyi is a WeChat mini-program client developed and iterated across distinct versions. The work spans a complete client experience, including authentication, paginated records, record status, report access, interface flows, and error handling. TypeScript and backend API integration support the connection between those screens and the information they present.',
          ],
        },
        {
          title: 'My contribution',
          paragraphs: [
            'I took responsibility for developing and iterating the whole mini-program client. That scope includes navigation, data access, and user-facing behavior around the individual features. Bringing these parts together means considering how a person moves through the client, from authentication to finding a record and opening a report.',
          ],
        },
        {
          title: 'Two distinct versions',
          paragraphs: [
            'The earlier V1 involved devices, measurement flows, and Bluetooth Low Energy state. The later V2 focuses on patients viewing their own measurement records and reports through a read-only experience. Keeping these versions separate is essential to explaining what the client does. V1’s device-control behavior is not part of the V2 feature description.',
            'The diagram illustrates the V2 viewing flow: authenticate, browse records, inspect a record, and access its report. This sequence keeps the patient’s own information at the center of the interface.',
          ],
        },
        {
          title: 'Engineering focus',
          paragraphs: [
            'A complete client has to make transitions between screens and data states understandable. Design concerns include how pagination fits the record list, how record status is communicated, and how report access behaves when a request fails. The read-only scope also needs to remain clear throughout the V2 interface.',
          ],
        },
        {
          title: 'Status & scope',
          paragraphs: [
            'This internship contribution covers the mini-program client; the company’s backend, hardware, and native app are separate parts of the product. The showcase describes the client’s scope without establishing production readiness or live device validation.',
          ],
        },
      ],
      zh: [
        {
          title: '项目概览',
          paragraphs: [
            '云心医是持续开发与迭代的微信小程序客户端，不同版本有各自明确的范围。工作覆盖完整客户端体验，包括认证、记录分页、记录状态、报告访问、界面流程和异常处理，通过 TypeScript 与后端 API 集成，把页面和所需资料连接起来。',
          ],
        },
        {
          title: '我的工作',
          paragraphs: [
            '我承担整个微信小程序客户端的开发与迭代，工作包括各项功能周围的导航、资料访问和用户交互。把这些部分接起来，需要考虑用户如何从认证进入客户端，再找到记录并打开报告。',
          ],
        },
        {
          title: '明确区分两个版本',
          paragraphs: [
            '早期 V1 涉及设备、测量流程与低功耗蓝牙状态。后续 V2 聚焦患者本人只读查看测量记录与报告。理解客户端时，需要保留这条版本边界：V1 的设备控制行为不属于 V2 的功能说明。',
            '流程图展示的是 V2 的查看路径：认证、浏览记录、查看记录详情、访问报告。这个顺序始终围绕患者本人的资料展开。',
          ],
        },
        {
          title: '工程关注点',
          paragraphs: [
            '完整客户端需要让页面跳转和数据状态变化容易理解。设计需要关注分页与记录列表如何配合、记录状态如何表达，以及报告请求失败时如何处理。V2 界面还需要始终保持清晰的只读范围。',
          ],
        },
        {
          title: '阶段与范围',
          paragraphs: [
            '这段实习工作覆盖微信小程序客户端，公司的后端、硬件和原生 App 属于产品的其他部分。这里说明客户端的贡献范围，不据此宣称生产就绪或完成真实设备验证。',
          ],
        },
      ],
    },
    workflow: {
      en: ['V2 · Authenticate', 'Browse own records', 'View record details', 'Access a report'],
      zh: ['第二版 · 身份认证', '浏览本人记录', '查看记录详情', '访问报告'],
    },
  },
  {
    slug: 'ml-pipeline',
    categories: ['ai', 'experiments'],
    tech: ['Python', 'Machine learning', 'Rolling backtests', 'LEAN'],
    color: '#B8D1E8',
    title: { en: 'ML Research Pipeline', zh: '机器学习实验系统' },
    shortTitle: { en: 'ML Research Pipeline', zh: '机器学习实验系统' },
    description: {
      en: 'A research pipeline for time-aware model evaluation, backtesting, and execution-oriented experiments.',
      zh: '组织时间划分验证、滚动回测与执行衔接实验，让机器学习研究形成清楚的流程。',
    },
    status: { en: 'Research prototype', zh: '研究原型' },
    kind: { en: 'Research & engineering', zh: '研究与工程' },
    sections: {
      en: [
        {
          title: 'Overview',
          paragraphs: [
            'The ML Research Pipeline organizes the path from data and features to model comparison, time-based validation, rolling backtests, and execution-oriented experiments. It is a Python research prototype with a connection to LEAN. The project is about making those stages part of a coherent research workflow and examining what each stage can actually tell us.',
            'A prediction is one output in that workflow. Evaluating it also involves its place in time, the cost of turning it into an action, and the connection between the research process and an execution environment.',
          ],
        },
        {
          title: 'My contribution',
          paragraphs: [
            'My work centers on organizing data, features, and model comparisons, along with time-split validation and trading-cost evaluation. It also includes connecting prediction and execution stages. Working across these stages keeps the evaluation process connected to the conditions under which a prediction would be used.',
          ],
        },
        {
          title: 'Research flow',
          paragraphs: [
            'The sequence moves from data and feature preparation through model comparison, then into time-aware evaluation and a cost-aware backtest before the execution connection. The diagram shows how the stages relate, with separate places for assessing a prediction and considering its use in an execution experiment.',
          ],
        },
        {
          title: 'Engineering focus',
          paragraphs: [
            'The design questions concern the reliability of an experiment’s interpretation: which information belongs in each time period, whether model comparisons use a consistent evaluation setup, and how costs affect the result being examined. The handoff from a prediction to an execution experiment is another boundary to inspect, rather than assume away.',
          ],
        },
        {
          title: 'Status & scope',
          paragraphs: [
            'This is a research prototype for investigating models and execution workflows, not a promise of returns or an established profitable strategy. It is not presented as financial advice or evidence of successful live trading.',
          ],
        },
      ],
      zh: [
        {
          title: '项目概览',
          paragraphs: [
            '机器学习实验系统把数据、特征、模型比较、时间划分验证、滚动回测和面向执行的实验组织起来。这是一个使用 Python、涉及 LEAN 衔接的研究原型，关注如何让各阶段形成清楚的研究流程，以及每个阶段的结果究竟能够说明什么。',
            '预测只是流程中的一个输出。评估它还需要考虑时间关系、把预测转化为行动的成本，以及研究过程与执行环境之间的连接。',
          ],
        },
        {
          title: '我的工作',
          paragraphs: [
            '我的工作围绕数据、特征和模型比较的组织展开，也包括时间划分验证、交易成本评估，以及预测和执行环节的衔接。跨越这些阶段开展工作，是为了让评估过程与预测将被使用的条件保持联系。',
          ],
        },
        {
          title: '研究流程',
          paragraphs: [
            '流程从数据和特征准备出发，经过模型比较、按时间验证与考虑成本的回测，再到执行衔接。示意图呈现了各阶段之间的关系，区分对预测本身的评估，以及它在执行实验中的使用。',
          ],
        },
        {
          title: '工程关注点',
          paragraphs: [
            '设计重点在于能否可靠地解释一次实验：每个时间区间应该使用哪些信息，模型比较是否采用一致的评估条件，成本会怎样影响正在考察的结果。预测进入执行实验的过程也是需要检查的边界，不能默认两者自然等价。',
          ],
        },
        {
          title: '阶段与范围',
          paragraphs: [
            '项目仍是研究原型，用于探索模型与执行流程，不承诺收益或稳定盈利。项目内容不作为金融建议，也不代表已经实现成功的真实交易。',
          ],
        },
      ],
    },
    workflow: {
      en: ['Data & features', 'Compare models', 'Validate across time', 'Backtest with costs', 'Connect execution'],
      zh: ['数据与特征', '比较模型', '按时间验证', '计入成本回测', '衔接执行'],
    },
  },
  {
    slug: 'admin-modernization',
    categories: ['software'],
    tech: ['Vue', 'TypeScript', 'Vben Admin', 'Java / Spring', 'MySQL', 'Redis'],
    color: '#D0DFEE',
    title: { en: 'Admin Platform Modernization', zh: '管理平台现代化' },
    shortTitle: { en: 'Admin Modernization', zh: '管理平台现代化' },
    description: {
      en: 'Modernizing an administrative interface while integrating with an existing backend and permission model.',
      zh: '迁移既有管理系统的前端，适配原有后端接口、登录流程与菜单权限。',
    },
    status: { en: 'Internship project', zh: '实习项目' },
    kind: { en: 'Frontend modernization', zh: '前端迁移与重构' },
    sections: {
      en: [
        {
          title: 'Overview',
          paragraphs: [
            'This project concerns a new frontend for the existing Jiajiankang administrative system. The work connects a Vue and TypeScript interface using Vben Admin with an established backend and permission model. The broader technology context includes Java / Spring, MySQL, and Redis.',
            'Modernization here involves more than the appearance of individual screens. The interface needs to connect to the system’s existing login flow, menu permissions, and APIs, while the older backend still has to build and start for integration work to proceed.',
          ],
        },
        {
          title: 'My contribution',
          paragraphs: [
            'My contribution covers frontend migration and interface adaptation, together with work on the older backend’s build and startup. The integration scope includes login, menu permissions, and read-only validation. These pieces connect the new frontend to the behavior already defined by the existing system.',
          ],
        },
        {
          title: 'Integration flow',
          paragraphs: [
            'The diagram follows a user-facing path from login through menu permissions to a read-only interface connected with existing APIs. These steps bring together identity, access, and data presentation: the interface needs both the right information and the appropriate permission to show it.',
          ],
        },
        {
          title: 'Engineering focus',
          paragraphs: [
            'Important questions include whether the new interface reflects the permission model consistently and whether its requests match the existing API contracts. Backend startup is another practical dependency: an interface cannot be evaluated in context if its supporting service is unavailable. These relationships make the migration an integration problem as well as an interface problem.',
          ],
        },
        {
          title: 'Status & scope',
          paragraphs: [
            'This internship project covers migration and read-only integration. It does not claim that the entire production system has been replaced. Login and automated checks provide bounded functional evidence; long-term stability in a real environment requires a separate assessment.',
          ],
        },
      ],
      zh: [
        {
          title: '项目概览',
          paragraphs: [
            '这个项目围绕家健康既有管理系统开展新前端迁移，使用 Vue、TypeScript 与 Vben Admin，对接原有后端与权限模型。系统相关技术还包括 Java / Spring、MySQL 和 Redis。',
            '这里的现代化不只涉及页面外观。新界面需要接上已有的登录流程、菜单权限和 API；开展联调之前，也需要处理旧后端的构建与启动问题。',
          ],
        },
        {
          title: '我的工作',
          paragraphs: [
            '我的工作覆盖前端迁移与接口适配，并涉及旧后端构建和启动。联调范围包括登录、菜单权限与只读验证，把新前端接入既有系统已经定义的行为。',
          ],
        },
        {
          title: '集成流程',
          paragraphs: [
            '流程图沿着用户路径展开：完成登录，获得相应菜单权限，再通过既有 API 使用只读界面。这些步骤把身份、访问权限和资料呈现连接起来：界面既需要正确的信息，也需要具备展示它的相应权限。',
          ],
        },
        {
          title: '工程关注点',
          paragraphs: [
            '设计需要关注新界面能否一致地表达原有权限，以及请求是否符合既有接口约定。后端启动也是实际依赖：支撑服务不可用，就无法在完整上下文中检查界面。因此，这次迁移既需要处理界面，也需要处理系统之间的集成关系。',
          ],
        },
        {
          title: '阶段与范围',
          paragraphs: [
            '这段实习工作涉及迁移与只读联调，不宣称已经全面替换生产系统。登录与自动化检查提供的是有限范围的功能证据，真实环境中的长期稳定性需要单独评估。',
          ],
        },
      ],
    },
    workflow: {
      en: ['Sign in', 'Resolve menu permissions', 'Open read-only views', 'Connect existing APIs'],
      zh: ['完成登录', '读取菜单权限', '打开只读界面', '对接既有接口'],
    },
  },
  {
    slug: 'registry-integrity',
    categories: ['software'],
    tech: ['FastAPI', 'MySQL', 'Vue'],
    color: '#C2DAD8',
    title: { en: 'Registry Data Integrity', zh: '登记系统数据一致性' },
    shortTitle: { en: 'Registry Integrity', zh: '登记数据一致性' },
    description: {
      en: 'Improving record integrity through consistent validation, edit handling, and soft-delete-aware logic.',
      zh: '围绕病案号唯一性、编辑校验与软删除处理，让前后端遵守一致的数据规则。',
    },
    status: { en: 'Internship project', zh: '实习项目' },
    kind: { en: 'Data integrity', zh: '数据完整性' },
    sections: {
      en: [
        {
          title: 'Overview',
          paragraphs: [
            'This project focuses on record integrity in the BCTP registry system. Its core concerns are medical-record-number uniqueness, excluding the current record when validating an edit, and consistency around soft deletion. The technology context is FastAPI, MySQL, and Vue.',
            'The work sits at the meeting point of an interface rule and the data it protects. A uniqueness check has to mean the same thing when information is entered, edited, or evaluated alongside records with different deletion states.',
          ],
        },
        {
          title: 'My contribution',
          paragraphs: [
            'My contribution addresses those validation and consistency concerns across the frontend and backend. The focus is on record-number handling, recognizing the record currently being edited, and accounting for soft-deleted records. Connecting these checks helps express a single rule across the parts of the system involved in saving a change.',
          ],
        },
        {
          title: 'Validation flow',
          paragraphs: [
            'The workflow begins with a proposed change, identifies the edit context, applies the relevant uniqueness and deletion-state rules, and returns a validation result. The diagram separates those concerns so that the identity of the edited record and the status of other records remain visible parts of the reasoning.',
          ],
        },
        {
          title: 'Engineering focus',
          paragraphs: [
            'An edit should not treat the current record as its own duplicate. Soft deletion adds a separate question about which records participate in the uniqueness rule. The engineering concern is to keep these interpretations aligned wherever the rule is applied, so interface feedback and backend validation do not describe different requirements.',
          ],
        },
        {
          title: 'Status & scope',
          paragraphs: [
            'This internship contribution focuses on validation and data consistency within an existing registry. The example is limited to those rules and uses an illustrative workflow; it does not represent a complete system audit or production acceptance assessment.',
          ],
        },
      ],
      zh: [
        {
          title: '项目概览',
          paragraphs: [
            '这个项目关注 BCTP 登记系统的数据完整性，核心问题是病案号唯一性、编辑时排除当前记录，以及软删除相关的一致性处理。相关技术包括 FastAPI、MySQL 和 Vue。',
            '工作位于界面规则与底层数据之间。无论新增、编辑，还是面对不同删除状态的记录，唯一性校验都需要表达一致的含义。',
          ],
        },
        {
          title: '我的工作',
          paragraphs: [
            '我的工作围绕前后端校验与数据一致性展开，重点是病案号处理、识别正在编辑的记录，以及考虑软删除记录。把这些检查连接起来，让保存修改所涉及的不同系统部分表达同一套规则。',
          ],
        },
        {
          title: '校验流程',
          paragraphs: [
            '流程从待保存的修改开始，识别编辑上下文，应用相应的唯一性与删除状态规则，再返回校验结果。示意图把这些问题分开呈现，让正在编辑的记录身份和其他记录的状态，都成为清楚可见的判断依据。',
          ],
        },
        {
          title: '工程关注点',
          paragraphs: [
            '编辑时，不应该把当前记录本身当作重复项。软删除又带来另一个问题：哪些记录应该参与唯一性规则。工程重点是让各处对这些问题的解释保持一致，使界面反馈和后端校验表达同一套要求。',
          ],
        },
        {
          title: '阶段与范围',
          paragraphs: [
            '这段实习工作关注既有登记系统中的校验与数据一致性。这里通过示意流程说明这几项规则，不代表完成整个系统审计或生产验收评估。',
          ],
        },
      ],
    },
    workflow: {
      en: ['Propose a change', 'Identify the current record', 'Check uniqueness & deletion state', 'Return validation'],
      zh: ['提交待保存修改', '识别当前记录', '检查唯一性与删除状态', '返回校验结果'],
    },
  },
];
