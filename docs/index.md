<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vitepress'

const router = useRouter()
onMounted(() => {
  const target = typeof __LATEST_ARTICLE_LINK__ === 'string' ? __LATEST_ARTICLE_LINK__ : '/'
  if (target && location.pathname === '/' && location.search === '' && location.hash === '') {
    router.go(target)
  }
})
</script>

正在跳转到最新文章…

如果没有自动跳转，请从左侧「所有文章」选择阅读。


