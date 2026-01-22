# Filesystem 

Virtual filesystem is defined in /public/filesystem/filesystem.json

The structure is a graph of items,

{
 "items": 
 [
   {
     "type": "folder",
     "name": "CNC",
	   "path:" : "CNC"

     items: []
   }
 ]
}

Eaach item, can have the following properties:

type: folder, wordpad, notepad, archive, executable, html
name: displayed name
path: path inside /filesystem folder
image?: optional folder image name, without path (f.e. folder_image.jpg)
desc?: optional descriptopn text of the folder
size: size in bytes for files

The /public/filesystem/filesystem.json is build automatically with script tools/update_filesystem.py

Script scans public/filesysem directory.
If folder_image.jpg  is present, it is added to item.
If folder.md  is present, its conents are added as "desc".
Items are sorted alphabetically by display name during generation. Folders are placed fisrt.

name of the item/folder is generated from the name of file on filesystem.

Empty folders are removed from the structure.

Files with .txt extension are added as "notepad" type items and will open in Notepad when double-clicked.
Files with .md extension are added as "wordpad" type items and will open in Wordpad when double-clicked.
Files with .zip, .rar, .7z extension are added as "archive" type items. 
If archive contains .jsdos folder, anothet item is created with same name but type "executable". Executable is placed first.

Executable archives open in the DOSBox app; other archive types trigger a File Save dialog when double-clicked. DOSBox archives must contain a `.jsdos/dosbox.conf` with an `autoexec` section.

.html files have type html. html files are executed in the browser app