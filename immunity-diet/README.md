# 🌿 면역력 강화 맞춤 식단

매일 새롭게 AI가 생성하는 면역력 강화 맞춤 식단 앱입니다.

## 배포 방법 (Vercel)

### 1단계 - GitHub에 올리기
```bash
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/본인아이디/immunity-diet.git
git push -u origin main
```

### 2단계 - Vercel 연동
1. https://vercel.com 접속 → GitHub 로그인
2. "New Project" → 방금 올린 레포 선택
3. **Environment Variables** 항목에서 아래 추가:
   - Name: `VITE_ANTHROPIC_API_KEY`
   - Value: `sk-ant-...` (본인 Anthropic API 키)
4. "Deploy" 클릭

### 완료!
`https://immunity-diet.vercel.app` 같은 주소가 생성됩니다.
부모님 폰에 북마크로 저장해 두시면 됩니다 🌿
