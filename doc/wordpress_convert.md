
# Template rule for converting wordpress article

[location]=http://localhost:8080/?page_id=429

[target]=\trunk\public\filesystem\Publications\CNC\DIY_CNC1\DIY_CNC1.md 

1. Implement tools\fetch_article.py which 

Downloads article from page [location] and save HTML into trunk/temp folder.

Downloads all related images and saves to trunk/temp/images folder. Fixes links in html.
If there are two versions of images, preffer larger one.

Script shoudl only download file and images. It should not do conversion.

2. Use script to download article

3. Read the article fully.

Convert article to [target]

place images into /images subfolder. use relative path likeimages/01.jpg in .md file.

Make sure links are converted as links and code is displayed as code blocks.

do not use script to covnert article. Read and undestand it.

Try to preserve original formating.

Delete html and html images at finish.

Do not install aditional nodejs/python packages.

Double check result.