import DefaultTheme from "vitepress/theme";
import "./custom.css";
import ArticleList from "./components/ArticleList.vue";
import BackToList from "./components/BackToList.vue";
import Layout from "./Layout.vue";

export default {
  extends: DefaultTheme,
  Layout: Layout,
  enhanceApp({ app }) {
    app.component("ArticleList", ArticleList);
    app.component("BackToList", BackToList);
  },
};

