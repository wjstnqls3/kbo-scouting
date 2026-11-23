// DOM 상태 테스트 보조. 브라우저 레이아웃을 모사하지 않습니다.
const decode=s=>String(s).replace(/&(amp|lt|gt|quot|#39);/g,(_,key)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"}[key]));
class Element {
  constructor(tag,attrs={}) {
    this.tagName=tag;this.attrs=attrs;this.children=[];this.parent=null;this._text='';
    this.checked='checked' in attrs;this.disabled='disabled' in attrs;
    this.selected='selected' in attrs;this.dataset={};
    for(const key of Object.keys(attrs))if(key.startsWith('data-'))this.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=attrs[key];
    this._value=attrs.value||'';
  }
  get type(){return this.attrs.type||'';}
  get name(){return this.attrs.name||'';}
  get value(){return this.tagName==='select'?(this.options.find(x=>x.selected)||this.options[0])?.value||'':this.tagName==='option'?('value' in this.attrs?this.attrs.value:this.textContent):this._value;}
  set value(value){this._value=String(value);if(this.tagName==='select')for(const option of this.options)option.selected=option.value===String(value);}
  get selectedOptions(){return this.options.filter(x=>x.value===this.value);}
  reportValidity(){return true;}
  setAttribute(key,value){this.attrs[key]=String(value);}
  removeAttribute(key){delete this.attrs[key];}
  focus(){}
  addEventListener(){}
  get options(){return this.querySelectorAll('option');}
  get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
  set textContent(text){this.children=[];this._text=String(text);}
  set innerHTML(html){this.children=[];this._text='';parse(String(html),this);}
  get innerHTML(){return this.textContent;}
  querySelectorAll(selector){return descendants(this).filter(e=>matches(e,selector));}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  scrollIntoView(){}
  click(){if(this.disabled)return;if(this.tagName==='input'&&this.type==='checkbox'){this.checked=!this.checked;this.change();}else if(this.onclick)this.onclick({target:this});}
  change(){for(let node=this;node;node=node.parent)if(node.onchange)node.onchange({target:this});}
}
function descendants(el){return el.children.flatMap(child=>[child,...descendants(child)]);}
function matches(el,selector){
  const tag=selector.match(/^[a-z]+/);if(tag&&el.tagName!==tag[0])return false;
  for(const [,key,value] of selector.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g))if(!(key in el.attrs)||(value!==undefined&&el.attrs[key]!==value))return false;
  if(selector.includes(':checked')&&!el.checked)return false;
  return true;
}
function parse(html,parent){
  const stack=[parent],voids=new Set(['input','meta','link','br','hr','img']);
  for(const token of html.match(/<[^>]+>|[^<]+/g)||[]) {
    if(token.startsWith('</')){const tag=token.slice(2).replace('>','').trim();let i=stack.length-1;while(i>0&&stack[i].tagName!==tag)i--;if(i>0)stack.length=i;continue;}
    if(token.startsWith('<!'))continue;
    if(token.startsWith('<')){
      const m=token.match(/^<([a-z][a-z0-9-]*)/i);if(!m)continue;
      const tag=m[1].toLowerCase(),attrs={};
      const raw=token.slice(m[0].length,-1);
      for(const [,key,double,single,plain] of raw.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))attrs[key]=decode(double??single??plain??'');
      const el=new Element(tag,attrs);el.parent=stack.at(-1);el.parent.children.push(el);
      if(!voids.has(tag)&&!token.endsWith('/>'))stack.push(el);
    }else {
      const parent=stack.at(-1);
      // HTML consumes the first newline immediately following a textarea start tag.
      const content=parent.tagName==='textarea' && !parent._text ? token.replace(/^\n/,'') : token;
      parent._text+=decode(content);
    }
  }
}

module.exports={Element,parse,descendants};
