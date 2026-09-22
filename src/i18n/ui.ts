export type Lang = 'en' | 'zh';
export const languages: Lang[] = ['en', 'zh'];
export const mainPages = ['work', 'about', 'resume'] as const;
export const ui = {
  en: {
    home: 'Home', work: 'Work', about: 'About', resume: 'Résumé', skip: 'Skip to content',
    theme: 'Switch color theme', light: 'Use light theme', dark: 'Use dark theme', menu: 'Open navigation', close: 'Close navigation',
    introName: "Hi, I’m Mingyang Yu.", campus: 'UC Irvine · Computer Science', hero: ['Building ideas,', 'one block', 'at a time.'],
    intro: "I'm a computer science student at UC Irvine, exploring applied AI, building software, and making room for playful ideas.",
    explore: 'Explore my work', aboutMe: 'About me', selected: 'Selected work', selectedSub: 'A few things I’m putting together.', allWork: 'All projects',
    workTitle: 'Ideas, put to work.', workDesc: 'Applied AI, software systems, and experiments that start with curiosity. A closer look at what I’m building and the questions behind it.',
    filters: ['All', 'Applied AI', 'Software', 'Experiments'], project: 'View project', diagram: 'Illustrative diagram', concept: 'Concept illustration',
    briefAbout: 'Curiosity meets implementation.', briefText: 'I like connecting the pieces: understanding a problem, building a system, and testing where it breaks.',
    experience: 'Along the way', moreAbout: 'A little more about me',
    contact: 'Let’s connect.', contactDesc: 'Have an idea, a question, or just want to say hello?', email: 'Send me an email', copy: 'Copy email', copied: 'Email copied', copyFailed: 'Could not copy. Select the email address below.',
    github: 'Find me on GitHub', footer: 'Built with curiosity. And a few ice bricks.', rights: 'Mingyang Yu',
    aboutTitle: 'Between ideas\nand making things.', aboutSubtitle: 'Computer science student. Curious builder.', education: 'Education', educationDesc: 'University of California, Irvine', degree: 'Computer Science · Undergraduate, in progress',
    interests: 'What keeps me curious', interestTitles: ['Applied AI', 'Software systems', 'Interactive experiments'], interestBody: ['Making context useful, while being clear about its limits.', 'Connecting interfaces, data, and the rules between them.', 'Small worlds where a simple idea can turn into something playful.'],
    resumeTitle: 'Mingyang Yu', resumeSubtitle: 'Computer Science · University of California, Irvine', print: 'Print / Save as PDF', resumeNote: 'A concise web résumé based on the information shared here.', focus: 'Focus', projects: 'Selected projects', skills: 'Tools & technologies',
    backWork: 'Back to work', related: 'Keep exploring', flow: 'At a glance', notFound: 'This block is out of place.', notFoundDesc: 'The page you’re looking for isn’t here. Let’s find a better starting point.', backHome: 'Back home',
    greeting: 'Hey there. Glad you’re here.', greet: 'Say hello to Mingyang', hello: 'Say hello', pause: 'Pause animation', resumeAnimation: 'Resume animation',
    noJs: 'The core site works without JavaScript. Enable it for interactive controls.', download: 'Download résumé PDF',
  },
  zh: {
    home: '首页', work: '作品', about: '关于', resume: '简历', skip: '跳到正文',
    theme: '切换配色主题', light: '切换浅色主题', dark: '切换深色主题', menu: '打开导航', close: '关闭导航',
    introName: '你好，我是余明阳。', campus: '加州大学欧文分校 · 计算机科学', hero: ['把想法，', '一块块', '搭起来。'],
    intro: '我是余明阳，就读于加州大学欧文分校计算机科学专业。我喜欢把 AI 与软件中的想法做成能用的东西，也给有趣的实验留一点空间。',
    explore: '看看我的作品', aboutMe: '认识一下我', selected: '精选作品', selectedSub: '把好奇心变成可以探索的东西。', allWork: '全部作品',
    workTitle: '让想法，有迹可循。', workDesc: '从应用 AI、软件系统，到始于好奇的小实验。这里记录我正在搭建的东西，以及背后的工程问题。',
    filters: ['全部', '应用 AI', '软件系统', '探索实验'], project: '查看项目', diagram: '示意图', concept: '概念示意',
    briefAbout: '从好奇，到动手。', briefText: '我喜欢把零散的部分连接起来：理解一个问题，搭出一个系统，再看看它会在哪里出错。',
    experience: '走过的路', moreAbout: '再多了解一点',
    contact: '聊聊你的想法。', contactDesc: '有个想法、一个问题，或者只是想打个招呼？', email: '给我发邮件', copy: '复制邮箱', copied: '邮箱已复制', copyFailed: '未能复制，请直接选中下方邮箱地址。',
    github: '在 GitHub 找到我', footer: '用好奇心，和几块冰积木搭成。', rights: '余明阳',
    aboutTitle: '在想法与\n动手之间。', aboutSubtitle: '计算机科学学生，也喜欢把想法做出来。', education: '教育', educationDesc: '加州大学欧文分校', degree: '计算机科学本科 · 在读',
    interests: '好奇心的方向', interestTitles: ['应用 AI', '软件系统', '交互实验'], interestBody: ['让上下文真正有用，也清楚呈现它的局限。', '连接界面、数据，以及两者之间的规则。', '在小小的世界里，把一个简单念头变成有趣的体验。'],
    resumeTitle: '余明阳 / Mingyang Yu', resumeSubtitle: '计算机科学 · 加州大学欧文分校', print: '打印 / 保存为 PDF', resumeNote: '根据本站已提供信息整理的简洁网页简历。', focus: '关注方向', projects: '项目经历', skills: '工具与技术',
    backWork: '返回作品列表', related: '继续探索', flow: '流程一览', notFound: '这一块，好像放错了。', notFoundDesc: '这里没有你要找的页面。换个地方，继续探索吧。', backHome: '回到首页',
    greeting: '你好，很高兴在这里遇见你。', greet: '向明阳打个招呼', hello: '打个招呼', pause: '暂停动画', resumeAnimation: '恢复动画',
    noJs: '关闭 JavaScript 仍可阅读本站。启用后可使用交互控件。', download: '下载正式简历 PDF',
  },
} as const;
export function route(lang: Lang, path = '') { const clean=path.replace(/^\/+|\/+$/g, ''); return `/${lang}/${clean ? clean + '/' : ''}`; }
export function alternatePath(path: string, target: Lang) {
  const clean = path.replace(/^\/(en|zh)(?=\/|$)/, '').replace(/^\/+|\/+$/g, '');
  return route(target, clean);
}
