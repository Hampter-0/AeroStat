// Rebuild when a migration is added, since sqlx::migrate! embeds them at compile time.
fn main() {
    println!("cargo:rerun-if-changed=migrations");
}
