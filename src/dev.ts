import WebIME from "./index";

const words = ["എന്നും", "ഇവിടെ", "പായസം"];

const webIME = new WebIME({
  values: (text, cb) => cb(words.map((word) => ({ key: text, value: word }))),
  menuItemTemplate: (item) => {
    return "<span>" + item.original.value + "</span>";
  },
});

webIME.attach(document.getElementById("inputElement"));
