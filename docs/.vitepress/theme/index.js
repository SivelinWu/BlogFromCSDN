import DefaultTheme from "vitepress/theme";
import "./custom.css";
import ArticleList from "./components/ArticleList.vue";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("ArticleList", ArticleList);
  },
};

