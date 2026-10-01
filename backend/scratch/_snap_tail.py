    size_kb = os.path.getsize(SNAPSHOT_FILE) / 1024
    print("\n  Snapshot saved -> " + SNAPSHOT_FILE)
    print(f"  File size: {size_kb:.1f} KB")
    print("=" * 60)
    print("  SNAPSHOT COMPLETE - run reset_db.py to restore this state")
    print("=" * 60)
    print()


if __name__ == "__main__":
    take_snapshot()
