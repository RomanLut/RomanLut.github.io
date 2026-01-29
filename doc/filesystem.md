# Filesystem 

Virtual filesystem is defined in /public/filesystem/filesystem.json

The structure is a graph of items,

{
 "items": 
 [
   {
     "type": "folder",
     "name": "CNC",
	   "path:" : "CNC",
     "reference: "No",
     items: []
   }
 ]
}

Each item, can have the following properties:

type: folder, wordpad, notepad, archive, executable, html, sound, image, youtube, github
name: displayed name
path: path inside /filesystem folder
image?: optional folder image name, without path (f.e. folder_image.jpg)
desc?: optional description text of the folder
size: size in bytes for files
reference: Yes if this file or folder is shortcut. File Explorer will show shortcut icon ot top of normal icon.

The /public/filesystem/filesystem.json is build automatically with script tools/update_filesystem.py

Script scans public/filesysem directory.
If folder_image.jpg  is present, it is added to folder item. No file item is created folder_image.jpg.
If folder.md  is present, its conents are added as "desc". No file item is created folder.md.
Items are sorted alphabetically by display name during generation. Folders are placed fisrt.

name of the item/folder is generated from the name of file on filesystem.

Empty folders are removed from the structure.
'images' folder should not be parsed.

Files with .txt extension are added as "notepad" type items and will open in Notepad when double-clicked.
Files with .md extension are added as "wordpad" type items and will open in Wordpad when double-clicked.
Files with .zip, .rar, .7z extension are added as "archive" type items. 
Files with .jpg, .png, .gif extension are added as "image" type items. Images inside /images folders are ignored.
Files with .url  extension are added as "github, youtube or html" type item depending on the link inside file. 
.html files have type html. 

If archive contains .jsdos folder, anothet item is created with same name but type "executable". Executable is placed first.

Executable archives open in the DOSBox app; other archive types trigger a File Save dialog when double-clicked. DOSBox archives must contain a `.jsdos/dosbox.conf` with an `autoexec` section.

html, github and youtube files are executed with navigateToUrl()
 
I folder contains references.txt, it has to be parsed.
file contains a path to file or folder like "Publications/2013-04_Opto_isolated_AVR910/". Folder reference ends with slash.
Script should verify if actual folder or file exists and show error if not.
reference.txt itself is not added to the list.