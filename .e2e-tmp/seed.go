//go:build ignore
// 一次性种子脚本：生成 e2e 账号的 bcrypt hash 并插入 Go 后端 MySQL
package main

import (
	"database/sql"
	"fmt"
	"log"

	_ "github.com/go-sql-driver/mysql"
	"golang.org/x/crypto/bcrypt"
	"github.com/google/uuid"
)

func main() {
	dsn := "root:yanhuo123@tcp(192.168.100.248:13306)/luban?charset=utf8mb4&parseTime=true&loc=Local"
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		log.Fatal("open:", err)
	}
	defer db.Close()

	const (
		username = "e2e"
		password = "e2e@2026"
		name     = "E2E Tester"
		role     = "admin"
	)
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatal("hash:", err)
	}

	id := uuid.NewString()
	_, err = db.Exec(
		`INSERT INTO users (id, username, name, role, status, password, created_at, updated_at)
		 VALUES (?, ?, ?, ?, 'active', ?, NOW(3), NOW(3))
		 ON DUPLICATE KEY UPDATE password=VALUES(password), role=VALUES(role), status='active'`,
		id, username, name, role, string(hash),
	)
	if err != nil {
		log.Fatal("insert:", err)
	}
	fmt.Printf("[seed] 账号已就绪: %s / %s (role=%s, hash=%d chars)\n", username, password, role, len(hash))

	// 验证能查到
	var u string
	db.QueryRow("SELECT username FROM users WHERE username=?", username).Scan(&u)
	fmt.Printf("[seed] 验证: users.username=%s\n", u)
}
