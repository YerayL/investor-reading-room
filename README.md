# 投资文稿馆

读到一句投资判断，怎样找到它的出处，看看发言人当时面对的是什么问题？投资文稿馆把 **926 份公开文稿、中文详读和原文位置** 放进同一个离线阅读器。可以从一位投资人开始，也可以带着“什么时候卖出”这样的问题来查。

**在线阅读　[https://investor-reading-room.netlify.app](https://investor-reading-room.netlify.app)**

[下载完整离线阅读包](https://github.com/YerayL/investor-reading-room/releases/latest/download/investor-reading-room-offline.zip) · [浏览原稿](originals/) · [下载文稿目录](data/资料目录.csv)

[![观看投资文稿馆项目介绍](media/项目介绍封面.webp)](https://github.com/YerayL/investor-reading-room/releases/latest/download/investor-reading-room-intro.mp4)

[观看介绍视频](https://github.com/YerayL/investor-reading-room/releases/latest/download/investor-reading-room-intro.mp4) · [仓库内的 MP4](media/项目介绍.mp4) · [中文字幕](media/项目介绍.srt)

## 下载后怎样读

1. 下载上面的完整离线包，**把整个 ZIP 解压到一个文件夹**。
2. 双击 `index.html`。搜索、笔记、手册、原稿和介绍视频都可以断网打开。
3. 在笔记中点击「第 23 页」或「第 106 段」，回到对应版本的 PDF 或网页。网页有逐段视图，也可以打开原貌查看内嵌图表。

克隆仓库或下载 GitHub 源码 ZIP，同样可以双击入口。需要通过本机 HTTP 预览时，运行 `python serve.py`，然后打开 [本机阅读器](http://127.0.0.1:8726/)。每篇文稿还保留了出版方或主办方的在线来源链接。

## 从哪里开始

| 你想找什么 | 可以这样读 |
| --- | --- |
| 一句话在原文里的意思 | 搜索“添柏岚”，打开李录哥大课堂的中文记录，点击第 106 段，连着上下文读他怎样讨论门店与利润。 |
| 同一场演讲的中英文差别 | 搜索“全球价值投资与时代”。李录 2024 年北大演讲的六条原则在英文稿第 23 页、中文稿第 27 页，两篇笔记分别使用各自的页码。 |
| 给自己的持仓做一次检查 | 进入「实践手册」，从费用、估值、仓位或卖出等 12 个问题选一个。每章给出具体案例和检查步骤，还可填写、打印一页投资决策记录。 |
| 顺着一位作者读下去 | 在投资家目录中打开霍华德·马克斯，可逐篇展开全本收录的 162 篇备忘录。精选本 45 篇与全本重合，引用按各自版本标页。 |

馆藏按文件计数，分属 80 个人物或机构目录，含 **446 份 PDF（10,822 页）和 480 份 HTML（49,623 个编号段落）**。中文与英文版本、官方合订本与独立节选分别收录。整期刊物以目录所指的访谈为笔记范围，打开原稿可阅读整期。李录名下共有 32 份资料，喜马拉雅资本中英文目录中 19 个带题名的 PDF 均已与本地文件逐份比对。[中文目录](https://www.himcap.com/cn/publications) · [英文目录](https://www.himcap.com/publications) · [哥大 Heilbrunn Center](https://business.columbia.edu/heilbrunn/about/annual-letter)

## 项目文件

- `originals/` 按投资人保留原始 PDF 和 HTML。每份原稿的相对路径、出处与 SHA-256 都能在 [CSV 目录](data/资料目录.csv) 中查到，表内路径以此目录为基准。
- `data/paragraphs/` 是网页的编号阅读副本。`data/library.json` 和 `data/guide.json` 保存中文笔记、手册与引用关系。独立打开网页时使用 `data/offline.js`。
- `index.html`、`assets/` 是阅读器，`sources.html` 收录按人物整理的公开来源，`media/` 内有项目介绍视频、封面和字幕。
- `python tools/verify.py` 校验馆藏、引用和离线数据。运行 `python tools/package_offline.py ../investor-reading-room-offline.zip` 可自行生成完整离线包；打包程序会再核对包中每份原稿的 SHA-256。

## 开源与勘误

阅读器与工具代码采用 [MIT 许可证](LICENSE)。第三方原始文稿、图表及其逐段阅读副本按各自作者或出版方的条款使用；出处随文保留。

欢迎提交 [Issue](https://github.com/YerayL/investor-reading-room/issues) 或 Pull Request。勘误时请附文稿标题、页码或段号，并指出需要修订的笔记原句。
