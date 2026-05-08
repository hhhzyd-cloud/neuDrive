package config

import "testing"

func TestLoadWithOverridesParsesUserStorageQuotaUnits(t *testing.T) {
	cfg, err := LoadWithOverrides(map[string]string{
		"JWT_SECRET":               "secret",
		"VAULT_MASTER_KEY":         "vault",
		"USER_STORAGE_QUOTA_BYTES": "10GB",
	})
	if err != nil {
		t.Fatalf("LoadWithOverrides: %v", err)
	}
	const want = 10 * 1024 * 1024 * 1024
	if cfg.UserStorageQuotaBytes != want {
		t.Fatalf("UserStorageQuotaBytes = %d, want %d", cfg.UserStorageQuotaBytes, want)
	}
}

func TestLoadWithOverridesRejectsInvalidUserStorageQuota(t *testing.T) {
	_, err := LoadWithOverrides(map[string]string{
		"JWT_SECRET":               "secret",
		"VAULT_MASTER_KEY":         "vault",
		"USER_STORAGE_QUOTA_BYTES": "10XB",
	})
	if err == nil {
		t.Fatal("LoadWithOverrides succeeded for invalid storage quota")
	}
}

func TestLoadWithOverridesParsesGitMirrorManualSyncCooldown(t *testing.T) {
	cfg, err := LoadWithOverrides(map[string]string{
		"JWT_SECRET":       "secret",
		"VAULT_MASTER_KEY": "vault",
		"GIT_MIRROR_MANUAL_SYNC_COOLDOWN_SECONDS": "45",
	})
	if err != nil {
		t.Fatalf("LoadWithOverrides: %v", err)
	}
	if !cfg.GitMirrorManualSyncCooldownConfigured || cfg.GitMirrorManualSyncCooldownSeconds != 45 {
		t.Fatalf("cooldown = configured:%v seconds:%d, want configured:true seconds:45", cfg.GitMirrorManualSyncCooldownConfigured, cfg.GitMirrorManualSyncCooldownSeconds)
	}
}

func TestLoadWithOverridesRejectsInvalidGitMirrorManualSyncCooldown(t *testing.T) {
	_, err := LoadWithOverrides(map[string]string{
		"JWT_SECRET":       "secret",
		"VAULT_MASTER_KEY": "vault",
		"GIT_MIRROR_MANUAL_SYNC_COOLDOWN_SECONDS": "-1",
	})
	if err == nil {
		t.Fatal("LoadWithOverrides succeeded for invalid Git Mirror manual sync cooldown")
	}
}
