// Native test driver: `catalog` prints the engine command catalogue; `edit <in> <out.png> <commands.json>` runs the same
// bridge code the browser uses, so edits can be checked without a browser.
use skydata_photocraft_bridge::{Editor, catalog};
fn main() {
    let a: Vec<String> = std::env::args().collect();
    match a.get(1).map(String::as_str) {
        Some("catalog") => println!("{}", catalog(a.get(2).map(String::as_str) == Some("--all"))),
        Some("edit") => {
            let bytes = std::fs::read(&a[2]).expect("read input");
            let mut e = Editor::open(&a[2], &bytes).unwrap_or_else(|x| panic!("{x}"));
            let cmds = std::fs::read_to_string(&a[4]).expect("read commands");
            println!("{}", e.run(&cmds).unwrap_or_else(|x| panic!("{x}")));
            std::fs::write(&a[3], e.export("png", 90).unwrap_or_else(|x| panic!("{x}"))).expect("write");
        }
        _ => eprintln!("usage: bridge-native catalog [--all] | edit <in> <out.png> <commands.json>"),
    }
}
