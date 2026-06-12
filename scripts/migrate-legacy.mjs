import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();
const DATA_DIR = process.env.READPILOT_DATA_DIR || path.join(projectRoot, 'data');
const BOOKS_DIR = path.join(DATA_DIR, 'books');
const DB_PATH = path.join(DATA_DIR, 'readpilot.db');

console.log("=== ReadPilot Legacy Book Migration ===");
console.log(`DB Path: ${DB_PATH}`);
console.log(`Books Dir: ${BOOKS_DIR}`);

if (!fs.existsSync(DB_PATH)) {
    console.error(`Database not found at ${DB_PATH}`);
    process.exit(1);
}

const db = new Database(DB_PATH);
const books = db.prepare('SELECT id, title, data_dir FROM books').all();

let migratedCount = 0;

for (const book of books) {
    let oldDir = book.data_dir;
    let actualOldPath = null;
    let isAlreadyClean = false;
    
    // Find the physical path using the legacy resolve logic
    if (path.isAbsolute(oldDir) && fs.existsSync(oldDir)) {
        actualOldPath = oldDir;
    } else if (fs.existsSync(path.join(BOOKS_DIR, oldDir))) {
        // Already in the right root, but is the slug clean? 
        actualOldPath = path.join(BOOKS_DIR, oldDir);
        // We'll consider it clean if it's already inside data/books
        isAlreadyClean = true; 
    } else if (fs.existsSync(path.join(projectRoot, oldDir))) {
        actualOldPath = path.join(projectRoot, oldDir);
    }
    
    if (isAlreadyClean) {
        console.log(`[Skip]     "${book.title}" is already in ${BOOKS_DIR}`);
        continue;
    }

    if (!actualOldPath || !fs.existsSync(actualOldPath)) {
        console.log(`[Missing]  Could not find physical path for "${book.title}" (data_dir: ${oldDir}). It might have been deleted manually.`);
        continue;
    }

    console.log(`[Found]    Legacy book "${book.title}" at ${actualOldPath}`);
    
    // Generate new valid slug
    const cleanTitle = book.title
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
        .replace(/\s+/g, '_')
        .slice(0, 50)
        .trim() || 'untitled';
    const newSlug = `${book.id.slice(0, 8)}_${cleanTitle}`;
    const newPhysicalPath = path.join(BOOKS_DIR, newSlug);
    
    console.log(`[Migrate]  Moving to -> ${newPhysicalPath}`);
    
    try {
        if (!fs.existsSync(newPhysicalPath)) {
            // copy instead of rename to prevent EXDEV error across partitions
            fs.cpSync(actualOldPath, newPhysicalPath, { recursive: true });
            fs.rmSync(actualOldPath, { recursive: true, force: true });
        }
        
        // Update Database to ONLY store the relative slug!
        db.prepare('UPDATE books SET data_dir = ? WHERE id = ?').run(newSlug, book.id);
        console.log(`[Success]  Updated DB record data_dir to: ${newSlug}`);
        migratedCount++;
    } catch(err) {
        console.error(`[Error]    Failed to migrate ${book.title}:`, err);
    }
}

console.log(`=== Migration Complete. Migrated ${migratedCount} books. ===`);
