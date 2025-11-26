import Link from "next/link"
import { Car, LogIn, LogOut, List } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Car className="h-8 w-8 text-primary" />
            <h1 className="text-xl font-bold text-foreground">摩托车停车管理系统</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-3">
          <Link href="/entry" className="block">
            <Card className="h-full transition-all hover:shadow-lg hover:border-primary">
              <CardHeader className="text-center">
                <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <LogIn className="h-8 w-8 text-green-600" />
                </div>
                <CardTitle className="text-lg">入场登记</CardTitle>
                <CardDescription>拍照识别车牌，生成电子停车票</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-green-600 hover:bg-green-700">开始入场</Button>
              </CardContent>
            </Card>
          </Link>

          <Link href="/exit" className="block">
            <Card className="h-full transition-all hover:shadow-lg hover:border-primary">
              <CardHeader className="text-center">
                <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
                  <LogOut className="h-8 w-8 text-orange-600" />
                </div>
                <CardTitle className="text-lg">出场登记</CardTitle>
                <CardDescription>扫码或搜索车牌，确认出场</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-orange-600 hover:bg-orange-700">开始出场</Button>
              </CardContent>
            </Card>
          </Link>

          <Link href="/vehicles" className="block">
            <Card className="h-full transition-all hover:shadow-lg hover:border-primary">
              <CardHeader className="text-center">
                <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                  <List className="h-8 w-8 text-blue-600" />
                </div>
                <CardTitle className="text-lg">车辆列表</CardTitle>
                <CardDescription>查看在场车辆，搜索历史记录</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-blue-600 hover:bg-blue-700">查看列表</Button>
              </CardContent>
            </Card>
          </Link>
        </div>
      </main>
    </div>
  )
}
