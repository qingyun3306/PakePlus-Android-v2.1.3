window.addEventListener("DOMContentLoaded",()=>{const t=document.createElement("script");t.src="https://www.googletagmanager.com/gtag/js?id=G-W5GKHM0893",t.async=!0,document.head.appendChild(t);const n=document.createElement("script");n.textContent="window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', 'G-W5GKHM0893');",document.body.appendChild(n)});// 封装为独立命名空间，避免全局污染
const PageStyleLoader = {
  // 配置项
  config: {
    TARGET_DOMAIN: 'fuhaogou.com',
    LOGIN_PAGE_PATH: '/account#/login',
    PAGE_CSS_MAP: {
      login: 'https://server.kexuny.cn/work/midd.css',
      chooseStore: 'https://server.kexuny.cn/work/mdxz.css',
      shop: 'https://server.kexuny.cn/work/shop.css',
      settlement: 'https://server.kexuny.cn/work/tixian.css',
      index: 'https://server.kexuny.cn/work/index.css',
      order: 'https://server.kexuny.cn/work/order.css',
      jiesuan: 'https://server.kexuny.cn/work/jiesuan.css',
      business: 'https://server.kexuny.cn/work/my.css'
    },
    REMOTE_JS_MAP: {
      shop: 'https://server.kexuny.cn/work/shop.js',
      settlement: 'https://server.kexuny.cn/work/tixian.js',
      index: 'https://server.kexuny.cn/work/index.js',
      order: 'https://server.kexuny.cn/work/order.js',
      jiesuan: 'https://server.kexuny.cn/work/jiesuan.js',
      business: 'https://server.kexuny.cn/work/my.js'
    },
    MAX_RETRY: 3, // 最大重试次数
    DEBOUNCE_TIME: 100, // 路由防抖时间
    OBSERVER_DEBOUNCE: 300 // 观察者防抖时间
  },

  // 状态管理
  state: {
    currentCssKey: null,
    isCssLoaded: false,
    isLoadingCss: false,
    cssLinkElement: null,
    lastPageFullPath: '',
    retryMap: {}, // 记录各资源重试次数
    mutationTimer: null,
    hashChangeTimer: null,
    observer: null,
    originalOpen: window.open // 保存原生open方法
  },

  // 工具方法
  utils: {
    // 环境判断：开发环境才输出日志
    isDev: true, // 生产环境改为false
    log(message) {
      if (this.isDev) console.log(`[PageStyleLoader] ${message}`);
    },
    error(message) {
      if (this.isDev) console.error(`[PageStyleLoader] ${message}`);
    },
    // URL合法性校验
    isValidUrl(url) {
      if (!url || typeof url!=='string') return false;
      try {
        new URL(url);
        return true;
      } catch (e) {
        return false;
      }
    },
    // 防抖函数
    debounce(fn, delay) {
      let timer = null;
      return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
      };
    }
  },

  // 1. 域名校验
  isTargetDomain() {
    const currentDomain = window.location.hostname;
    const isMatch = currentDomain.includes(this.config.TARGET_DOMAIN);
    if (!isMatch) {
      this.utils.log(`当前域名${currentDomain}非目标域名，停止执行脚本`);
    }
    return isMatch;
  },

  // 2. 页面类型判断（优化：精确匹配优先，避免误判）
  getCurrentPageType() {
    if (!this.isTargetDomain()) return 'unknown';

    const pathname = window.location.pathname || '';
    const hash = window.location.hash || '';
    const currentFullPath = (pathname + hash).trim();

    if (this.state.lastPageFullPath!== currentFullPath) {
      this.utils.log(`当前页面完整路径：${currentFullPath}`);
      this.state.lastPageFullPath = currentFullPath;
    }

    // 精确匹配优先，避免URL参数干扰
    if (currentFullPath === this.config.LOGIN_PAGE_PATH) {
      return 'login';
    } else if (currentFullPath === '/shop#/apps/multistore/store/index') {
      return 'index';
    } else if (currentFullPath === '/shop#/apps/multistore/store/business') {
      return 'business';
    } else if (currentFullPath === '/shop#/order/list/all') {
      return 'order';
    } else if (currentFullPath === '/shop#/apps/multistore/settlement/overview/index') {
      return 'jiesuan';
    } else if (currentFullPath.includes('/shop#/apps/multistore/settlement/overview/apply') &&
               currentFullPath.includes('type=goods')) {
      return 'settlement';
    } else if (currentFullPath.includes('/account#/shops/chooseStore')) {
      return 'chooseStore';
    } else if (pathname === '/shop' || currentFullPath.includes('/shop#')) {
      return'shop';
    } else {
      return 'unknown';
    }
  },

  // 3. 登录页校验
  isLoginPage() {
    return this.getCurrentPageType() === 'login';
  },

  // 4. 通用远程JS加载函数（增加重试次数限制）
  loadRemoteJs(jsKey, retryCount = 0) {
    if (!this.isTargetDomain()) return;

    const jsUrl = this.config.REMOTE_JS_MAP[jsKey];
    if (!this.utils.isValidUrl(jsUrl)) {
      this.utils.error(`无效的JS URL：${jsUrl}`);
      return;
    }

    // 检查是否已加载
    if (document.querySelector(`script[src="${jsUrl}"]`)) {
      this.utils.log(`远程JS文件${jsUrl}已加载，无需重复加载`);
      // 强制触发对应函数（兜底）
      if (jsKey ==='shop' && typeof window.injectBottomNav === 'function') {
        window.injectBottomNav();
      }
      return;
    }

    // 检查重试次数
    if (retryCount >= this.config.MAX_RETRY) {
      this.utils.error(`远程JS${jsUrl}重试${this.config.MAX_RETRY}次失败，停止重试`);
      return;
    }

    // 等待DOM完全就绪后加载JS
    const loadScript = () => {
      const script = document.createElement('script');
      script.src = jsUrl;
      script.type = 'text/javascript';
      script.async = true;

      script.onload = () => {
        this.utils.log(`远程JS文件${jsUrl}加载成功`);
        // 重置重试次数
        this.state.retryMap[jsUrl] = 0;
        // 立即调用导航栏注入（仅shop页面）
        if (jsKey ==='shop' && typeof window.injectBottomNav === 'function') {
          window.injectBottomNav();
        }
      };

      script.onerror = () => {
        const nextRetry = retryCount + 1;
        this.state.retryMap[jsUrl] = nextRetry;
        this.utils.error(`远程JS文件${jsUrl}加载失败，1秒后重试（剩余${this.config.MAX_RETRY - nextRetry}次）`);
        setTimeout(() => this.loadRemoteJs(jsKey, nextRetry), 1000);
      };

      // 安全插入script（优先head，若无则body）
      if (document.head) {
        document.head.appendChild(script);
      } else if (document.body) {
        document.body.appendChild(script);
      } else {
        setTimeout(loadScript, 200);
      }
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      loadScript();
    } else {
      document.addEventListener('DOMContentLoaded', loadScript);
    }
  },

  // 5. 预加载CSS（优化冲突处理）
  preloadCss(cssKey) {
    if (!this.isTargetDomain()) return;

    const cssUrl = this.config.PAGE_CSS_MAP[cssKey];
    if (!this.utils.isValidUrl(cssUrl)) {
      this.utils.error(`无效的CSS URL：${cssUrl}`);
      return;
    }

    this.utils.log(`预加载CSS：${cssUrl}`);

    // 先清理同URL的preload标签，避免冲突
    const existingPreload = document.querySelector(`link[rel="preload"][href="${cssUrl}"]`);
    if (existingPreload) existingPreload.remove();

    // 等待DOM就绪后创建link元素
    const createPreloadLink = () => {
      const preloadLink = document.createElement('link');
      preloadLink.rel = 'preload';
      preloadLink.href = cssUrl;
      preloadLink.as ='style';
      preloadLink.crossOrigin = 'anonymous';

      preloadLink.onload = () => {
        preloadLink.rel ='stylesheet';
        this.utils.log(`CSS预加载完成：${cssUrl}`);
        this.state.cssLinkElement = preloadLink;
        this.state.isCssLoaded = true;
        this.state.isLoadingCss = false;
        // 预加载完成后加载对应JS
        this.loadRemoteJs(cssKey);
      };

      preloadLink.onerror = () => {
        this.utils.error(`CSS预加载失败：${cssUrl}`);
        this.state.isLoadingCss = false;
        this.loadCss(cssKey); // 降级加载
      };

      // 安全插入到head（若无则body）
      if (document.head) {
        document.head.appendChild(preloadLink);
      } else if (document.body) {
        document.body.appendChild(preloadLink);
      } else {
        setTimeout(createPreloadLink, 200);
        return;
      }

      this.state.isLoadingCss = true;
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      createPreloadLink();
    } else {
      document.addEventListener('DOMContentLoaded', createPreloadLink);
    }
  },

  // 6. 加载CSS（增加重试限制+冲突处理）
  loadCss(cssKey, retryCount = 0) {
    if (!this.isTargetDomain() || this.state.isLoadingCss || this.state.isCssLoaded) return;

    const cssUrl = this.config.PAGE_CSS_MAP[cssKey];
    if (!this.utils.isValidUrl(cssUrl)) {
      this.utils.error(`无效的CSS URL：${cssUrl}`);
      return;
    }

    // 检查重试次数
    if (retryCount >= this.config.MAX_RETRY) {
      this.utils.error(`CSS${cssUrl}重试${this.config.MAX_RETRY}次失败，停止重试`);
      this.state.isLoadingCss = false;
      return;
    }

    this.state.isLoadingCss = true;
    this.utils.log(`开始加载CSS：${cssUrl}`);

    // 先清理同URL的preload标签
    const existingPreload = document.querySelector(`link[rel="preload"][href="${cssUrl}"]`);
    if (existingPreload) existingPreload.remove();

    // 复用缓存link元素（增加存在性检查）
    if (this.state.cssLinkElement && this.state.cssLinkElement.href === cssUrl) {
      const insertCss = () => {
        try {
          if (document.head) {
            document.head.appendChild(this.state.cssLinkElement);
          } else if (document.body) {
            document.body.appendChild(this.state.cssLinkElement);
          } else {
            setTimeout(insertCss, 200);
            return;
          }
          this.state.isCssLoaded = true;
          this.state.isLoadingCss = false;
          this.utils.log(`复用缓存的CSS link元素`);
          // 加载完成后加载对应JS
          this.loadRemoteJs(cssKey);
        } catch (e) {
          this.utils.error(`复用CSS失败：`, e);
          this.state.isLoadingCss = false;
          setTimeout(() => this.loadCss(cssKey, retryCount + 1), 1000);
        }
      };
      insertCss();
      return;
    }

    // 创建新link元素（增加DOM就绪检查）
    const createLink = () => {
      const link = document.createElement('link');
      link.rel ='stylesheet';
      link.href = cssUrl;
      link.crossOrigin = 'anonymous';
      link.media = 'all';
      link.setAttribute('importance', 'high');

      link.onload = () => {
        this.utils.log(`CSS加载成功：${cssUrl}`);
        this.state.currentCssKey = cssKey;
        this.state.isCssLoaded = true;
        this.state.isLoadingCss = false;
        this.state.cssLinkElement = link;
        // 重置重试次数
        this.state.retryMap[cssUrl] = 0;
        // 加载完成后加载对应JS
        this.loadRemoteJs(cssKey);
      };

      link.onerror = () => {
        const nextRetry = retryCount + 1;
        this.state.retryMap[cssUrl] = nextRetry;
        this.utils.error(`CSS加载失败：${cssUrl}，1秒后重试（剩余${this.config.MAX_RETRY - nextRetry}次）`);
        this.state.isLoadingCss = false;
        setTimeout(() => this.loadCss(cssKey, nextRetry), 1000);
      };

      // 安全插入link（修复insertBefore空指针）
      try {
        if (document.head) {
          if (document.head.firstChild) {
            document.head.insertBefore(link, document.head.firstChild);
          } else {
            document.head.appendChild(link);
          }
        } else if (document.body) {
          document.body.appendChild(link);
        } else {
          setTimeout(createLink, 200);
        }
      } catch (e) {
        this.utils.error(`插入CSS失败：`, e);
        this.state.isLoadingCss = false;
        setTimeout(() => this.loadCss(cssKey, retryCount + 1), 1000);
      }
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      createLink();
    } else {
      document.addEventListener('DOMContentLoaded', createLink);
    }
  },

  // 7. 移除旧CSS（增加存在性检查）
  removeOldCustomCss() {
    try {
      if (this.state.cssLinkElement) {
        this.state.cssLinkElement.remove();
        this.utils.log(`已移除旧CSS：${this.state.cssLinkElement.href}`);
      }
      const preloadLinks = document.querySelectorAll(`link[rel="preload"][href*="server.kexuny.cn/work/"]`);
      preloadLinks.forEach(link => link.remove());
    } catch (e) {
      this.utils.error(`移除旧CSS失败：`, e);
    }
    this.state.currentCssKey = null;
    this.state.isCssLoaded = false;
    this.state.cssLinkElement = null;
  },

  // 8. CSS加载控制（优化逻辑顺序）
  loadCurrentPageCss() {
    if (!this.isTargetDomain()) return;

    const newPageType = this.getCurrentPageType();

    // 未知页面：清理CSS
    if (newPageType === 'unknown') {
      if (this.state.currentCssKey!== null) {
        this.utils.log('当前页面无对应CSS配置，清理旧样式');
        this.removeOldCustomCss();
      }
      return;
    }

    // 页面类型变化：清理旧CSS + 预加载新CSS
    if (newPageType!== this.state.currentCssKey) {
      this.removeOldCustomCss();
      this.state.currentCssKey = newPageType;
      this.preloadCss(newPageType);
      // 立即加载对应JS
      this.loadRemoteJs(newPageType);
      return;
    }

    // 页面类型未变，但CSS未加载：立即加载
    if (!this.state.isCssLoaded &&!this.state.isLoadingCss) {
      this.loadCss(newPageType);
    }

    // 确保JS加载
    this.loadRemoteJs(newPageType);
  },

  // 9. 加载外部JS（增加重试限制）
  loadExternalScript(url, retryCount = 0) {
    if (!this.isTargetDomain()) return;

    if (!this.utils.isValidUrl(url)) {
      this.utils.error(`无效的外部JS URL：${url}`);
      return;
    }

    const existingScript = document.querySelector(`script[src="${url}"]`);
    if (existingScript) {
      this.utils.log(`备用JS已加载：${url}`);
      if (this.isLoginPage()) this.initLoginEventOnly();
      return;
    }

    // 检查重试次数
    if (retryCount >= this.config.MAX_RETRY) {
      this.utils.error(`备用JS${url}重试${this.config.MAX_RETRY}次失败，停止重试`);
      if (this.isLoginPage()) this.initLoginEventOnly();
      return;
    }

    const createScript = () => {
      const script = document.createElement('script');
      script.src = url;
      script.type = 'text/javascript';
      script.async = false;
      script.defer = false;

      script.onload = () => {
        this.utils.log(`备用JS加载成功：${url}`);
        this.utils.log('备用JS仅启用事件响应，屏蔽样式操作');
        // 重置重试次数
        this.state.retryMap[url] = 0;
        if (typeof window.hideElements === 'function') {
          const originalHideElements = window.hideElements;
          window.hideElements = () => {
            try {
              this.utils.log('屏蔽hideElements中的样式操作，仅保留事件逻辑');
              if (this.isLoginPage()) this.initLoginEventOnly();
            } catch (e) {
              this.utils.error('重写hideElements执行出错：', e);
            }
          };
          this.utils.log('已重写hideElements，仅保留事件功能');
        } else {
          if (this.isLoginPage()) this.initLoginEventOnly();
        }
      };

      script.onerror = () => {
        const nextRetry = retryCount + 1;
        this.state.retryMap[url] = nextRetry;
        this.utils.error(`备用JS加载失败：${url}，${this.config.MAX_RETRY - nextRetry}次重试`);
        setTimeout(() => this.loadExternalScript(url, nextRetry), 2000);
      };

      // 安全插入脚本
      if (document.head) {
        document.head.appendChild(script);
      } else if (document.body) {
        document.body.appendChild(script);
      } else {
        setTimeout(createScript, 200);
      }
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      createScript();
    } else {
      document.addEventListener('DOMContentLoaded', createScript);
    }
  },

  // 10. 登录事件初始化
  initLoginEventOnly() {
    if (!this.isLoginPage()) return;
    this.utils.log('开始初始化登录事件响应（无样式操作）');

    const waitForLoginBtn = () => {
      try {
        const loginBtn = document.querySelector('.style-login-botton.ivu-btn[data-v-2f9eb9a7]');
        if (!loginBtn) {
          setTimeout(waitForLoginBtn, 1000);
          return;
        }

        // 移除原有事件避免重复绑定
        loginBtn.removeEventListener('click', handleLoginClick);
        
        function handleLoginClick(e) {
          try {
            if (loginBtn.__vue__) {
              const vueInstance = loginBtn.__vue__;
              const commonLoginMethods = ['handleLogin', 'submitLogin', 'onLogin', 'login'];
              for (const method of commonLoginMethods) {
                if (typeof vueInstance[method] === 'function') {
                  vueInstance[method]();
                  this.utils.log(`登录事件：通过Vue方法[${method}]触发`);
                  return;
                }
              }
            }

            const loginForm = loginBtn.closest('form.ivu-form');
            if (loginForm) {
              e.preventDefault();
              const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
              loginForm.dispatchEvent(submitEvent);
              this.utils.log(`登录事件：通过表单submit触发`);
              return;
            }

            const nativeClickEvent = new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              view: window
            });
            loginBtn.dispatchEvent(nativeClickEvent);
            this.utils.log(`登录事件：通过原生点击事件触发`);
          } catch (e) {
            this.utils.error('处理登录点击失败：', e);
          }
        }

        loginBtn.addEventListener('click', handleLoginClick.bind(this));
        this.utils.log('登录事件响应初始化完成（无样式干扰）');
      } catch (e) {
        this.utils.error('初始化登录事件失败：', e);
        setTimeout(waitForLoginBtn, 1000);
      }
    };

    waitForLoginBtn();
  },

  // 11. 路由监听（优化性能+缩小监听范围）
  watchRouteChange() {
    if (!this.isTargetDomain()) return;

    // 监听hash变化（防抖）
    const handleHashChange = this.utils.debounce(() => {
      this.utils.log('路由hash变化，触发CSS检查和JS加载');
      this.loadCurrentPageCss();
    }, this.config.DEBOUNCE_TIME);

    window.addEventListener('hashchange', handleHashChange, { capture: true });
    this.state.hashChangeTimer = handleHashChange;

    // 监听Vue Router
    const checkVueRouter = () => {
      try {
        if (window.Vue && window.VueRouter) {
          const router = window.app?._router || window.$router || window.router;
          if (router && router.beforeEach) {
            router.beforeEach((to, from, next) => {
              this.utils.log(`Vue Router即将切换：${from.path} → ${to.path}`);
              const newPageType = this.getCurrentPageType();
              if (newPageType!== this.state.currentCssKey) {
                this.preloadCss(newPageType);
              }
              // 提前加载对应JS
              this.loadRemoteJs(newPageType);
              next();
            });

            router.afterEach(() => {
              setTimeout(() => this.loadCurrentPageCss(), 0);
            });

            this.utils.log('已监听Vue Router并提前预加载CSS和JS');
            return;
          }
        }
      } catch (e) {
        this.utils.error('监听Vue Router失败：', e);
      }
      setTimeout(checkVueRouter, 1000);
    };
    checkVueRouter();

    // 监听DOM变化（缩小范围+防抖）
    const initMutationObserver = () => {
      try {
        // 缩小监听范围：优先监听Vue根容器
        const observeTarget = document.querySelector('#app') || document.querySelector('.app') || document.body;
        if (!observeTarget) {
          setTimeout(initMutationObserver, 200);
          return;
        }

        const handleMutation = this.utils.debounce(() => {
          const newPageType = this.getCurrentPageType();
          if (newPageType!== this.state.currentCssKey ||!this.state.isCssLoaded) {
            this.utils.log('DOM稳定后触发CSS检查');
            this.loadCurrentPageCss();
          }
        }, this.config.OBSERVER_DEBOUNCE);

        this.state.observer = new MutationObserver(handleMutation);
        this.state.observer.observe(observeTarget, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['data-path', 'class', 'href'] // 仅监听路由相关属性
        });
        this.utils.log('MutationObserver初始化成功，监听范围：', observeTarget);
      } catch (e) {
        this.utils.error('初始化MutationObserver失败：', e);
        setTimeout(initMutationObserver, 200);
      }
    };
    initMutationObserver();
  },

  // 12. 事件绑定（点击/错误/窗口打开）
  bindGlobalEvents() {
    if (!this.isTargetDomain()) return;

    // Chunk加载失败处理
    const handleError = (e) => {
      if (e.target && e.target.tagName === 'SCRIPT' && e.target.src && e.target.src.includes('chunk')) {
        this.utils.error(`Chunk加载失败：${e.target.src}`);
        this.loadExternalScript(e.target.src);
      }
    };
    window.addEventListener('error', handleError, true);

    // 点击事件处理
    const hookClick = (e) => {
      try {
        const origin = e.target.closest('a');
        const isBaseTargetBlank = document.querySelector('head base[target="_blank"]');
        if ((origin && origin.href && origin.target === '_blank') || (origin && origin.href && isBaseTargetBlank)) {
          e.preventDefault();
          this.utils.log('处理新窗口链接：', origin.href);
          location.href = origin.href;
        }
      } catch (e) {
        this.utils.error('处理点击事件失败：', e);
      }
    };
    window.addEventListener('click', hookClick, true);

    // 拦截window.open（保留原生功能）
    window.open = (url, target, features) => {
      if (!this.isTargetDomain()) return this.state.originalOpen.call(window, url, target, features);
      if (!url) return this.state.originalOpen.call(window, url, target, features);
      
      this.utils.log('拦截window.open：', url);
      location.href = url;
      // 模拟返回值，避免页面报错
      return { closed: false, focus: () => {}, blur: () => {}, close: () => {} };
    };

    // 保存事件句柄，用于销毁
    this.state.globalEvents = {
      handleError,
      hookClick
    };
  },

  // 13. 销毁方法（清理事件监听）
  destroy() {
    // 清理hash变化监听
    if (this.state.hashChangeTimer) {
      window.removeEventListener('hashchange', this.state.hashChangeTimer);
    }
    // 清理全局事件
    if (this.state.globalEvents) {
      window.removeEventListener('error', this.state.globalEvents.handleError);
      window.removeEventListener('click', this.state.globalEvents.hookClick);
    }
    // 停止观察者
    if (this.state.observer) {
      this.state.observer.disconnect();
    }
    // 恢复原生window.open
    window.open = this.state.originalOpen;
    this.utils.log('PageStyleLoader已销毁');
  },

  // 14. 启动入口
  init() {
    if (!this.isTargetDomain()) return;

    this.utils.log(
      '%cbuild from PakePlus： https://github.com/Sjj1024/PakePlus',
      'color:orangered;font-weight:bolder'
    );

    // 初始化状态
    this.state.lastPageFullPath = '';
    this.state.retryMap = {};

    // 等待DOM完全就绪后执行
    const start = () => {
      this.state.currentCssKey = this.getCurrentPageType();
      this.watchRouteChange();
      this.bindGlobalEvents();
      this.loadCurrentPageCss();
      this.utils.log('PageStyleLoader初始化完成');
    };

    // 页面卸载时清理
    window.addEventListener('beforeunload', () => this.destroy());

    if (document.readyState === 'complete') {
      start();
    } else if (document.readyState === 'interactive') {
      setTimeout(start, 100);
    } else {
      document.addEventListener('DOMContentLoaded', () => setTimeout(start, 100));
      // 兜底：3秒后强制启动
      setTimeout(start, 3000);
    }
  }
};

// 启动脚本
PageStyleLoader.init();