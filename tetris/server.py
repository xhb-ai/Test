#!/usr/bin/env python3
"""
简单的HTTP服务器，用于运行俄罗斯方块游戏
"""

import http.server
import socketserver
import sys
import os

PORT = 8000

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # 添加CORS头，允许跨域访问
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, HEAD')
        super().end_headers()

def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    try:
        with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
            print(f"🎮 俄罗斯方块游戏服务器已启动")
            print(f"📱 访问地址: http://你的服务器IP:{PORT}")
            print(f"🚀 按 Ctrl+C 停止服务器")
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 服务器已停止")
        sys.exit(0)
    except OSError as e:
        if e.errno == 48:
            print(f"❌ 端口 {PORT} 已被占用，请尝试其他端口或关闭占用该端口的进程")
        else:
            print(f"❌ 错误: {e}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        PORT = int(sys.argv[1])
    main()
