import type { Metadata } from 'next';
export const metadata:Metadata={title:'会员中心 · ToTo趣味英语',description:'在小说的语境里读词、记词、复习。订单激活后使用手机号与密码登录。'};
export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="zh-CN"><head>
  <meta name="theme-color" content="#28483d"/>
  {['styles','portal','gaokao','ielts','kaoyan','cet'].map(name=><link key={name} rel="stylesheet" href={`/${name}.css?v=zones1`}/>)}
 </head><body>{children}<script type="module" src="/bootstrap.mjs?v=zones1"/></body></html>;
}
