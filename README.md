# WebsterParserh

![Build](https://github.com/ponychicken/WebsterParser/workflows/Build/badge.svg)

## A better dictionary for your mac

In the a blog post named [“You’re probably using the wrong dictionary”](http://jsomers.net/blog/dictionary), James Somers proposes using Webster’s Unabridged Dictionary as it provides more evocative and accurate definitions than most modern dictionaries.

The text of the 1913 version has been digitized and [can be found on Project GNU CIDE](https://puszcza.gnu.org.ua/git/?group=gcide). Unfortunately the text files are in a very arcane format. Being created before UTF-8 was commonly used, it specifies a lot of non-standard entities to encode the all the various accents and special symbols.

This project parses these original text files and creates a reasonably clean UTF-8 XML version which can be converted into a mac dictionary file with Apple’s Dictionary Kit.

![Screenshot of the dictionary](https://cloud.githubusercontent.com/assets/183302/4118412/ee98674e-32a0-11e4-99ad-062c0e54a138.png)

## How to build

### Requirements

* Node.js
* Xcode
* Apple’s Dictionary Developer Kit
    - Install instructions (as of 2020-02-08):
        1. Visit [More Downloads for Apple Developers](https://developer.apple.com/download/more/) and log in
        2. Search for “dictionary”
        3. Download the “Additional Tools for Xcode” that corresponds to the version you have installed
        4. Open the DMG
        5. Drag the “Dictionary Developer Kit” to `/Applications/Utilities`
            * Recent versions of macOS will require you do this via the GUI to properly authenticate

Once you have the above installed, clone the project & its submodules, then install & build the dictionary:

````bash
git clone --recurse-submodules git@github.com:ponychicken/WebsterParser
cd WebsterParser
npm install
npm run build_and_install
````

Building the dictionary might take a while (around three minutes on my machine)


## Just want the .dictionary file?

Download it in the [releases section](https://github.com/DieBuche/WebsterParser/releases) of this project.


## Using it on iOS?

You can use the dictionary file on your iDevice if it is jailbroken. SSH into your device and navigate to `/private/var/mobile/Library/Assets/com_apple_MobileAsset_DictionaryServices_dictionary2`. 
On your iDevice dowload any new stock dictionary (Select a word -> Define -> Manage -> Download) that you don't need.
In your SSH browser find out which folder was just added. Navigate to folderwithcrypticnumber/AssetData. Replace the .dictionary folder with the webster.dictionary folder, but keeping the name. You should now be able to lookup words. 
