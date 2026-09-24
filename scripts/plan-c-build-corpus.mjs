// Fixed, original, synthetic scene atoms. No application data, API calls or
// external corpora. Re-run to reproduce the checked-in pilot files.
import { writeFileSync, mkdirSync } from 'node:fs';

const destinations = [
  {person:'Ika',place:'ruang arsip balai warga',english:'the community hall archive',atmosphere:'di antara rak-rak yang berdebu',atmosphereEn:'dusty shelves stood around her',objects:[
    ['map biru','the blue folder','di rak paling bawah','on the lowest shelf','pintu lemari berderit sekali','the cabinet door creaked once'],
    ['pensil pendek','the short pencil','di tepi meja','at the edge of the table','jam dinding berhenti berdetak','the wall clock stopped ticking'],
    ['amplop cokelat','the brown envelope','di laci kiri','in the left drawer','hujan mulai terdengar di atap','rain began to sound on the roof'],
    ['buku catatan','the notebook','di atas kursi kosong','on the empty chair','lampu ruangan berkedip dua kali','the room light blinked twice'],
    ['kartu nama','the name card','di bawah map hijau','beneath the green folder','langkah kaki terdengar di lorong','footsteps sounded in the corridor'],
  ]},
  {person:'Nuri',place:'halte di tepi sungai',english:'the riverside bus stop',atmosphere:'di dekat pagar besi yang basah',atmosphereEn:'a wet iron railing stood nearby',objects:[
    ['payung merah','the red umbrella','di samping bangku','beside the bench','bus terakhir melintas tanpa berhenti','the last bus passed without stopping'],
    ['tas kain','the cloth bag','di pangkuannya','on her lap','angin menggoyang papan jadwal','the wind shook the timetable board'],
    ['tiket lama','the old ticket','di saku mantelnya','in her coat pocket','air sungai naik hingga tepi batu','the river rose to the stone edge'],
    ['botol air','the water bottle','di bawah bangku','under the bench','lampu halte menyala kembali','the bus stop light came on again'],
    ['syal abu-abu','the gray scarf','di bahunya','over her shoulders','dering bel sepeda terdengar dari jalan','a bicycle bell rang from the road'],
  ]},
  {person:'Bima',place:'kios buku tua',english:'the old book kiosk',atmosphere:'di antara tumpukan buku yang rapat',atmosphereEn:'stacks of books crowded around him',objects:[
    ['novel bersampul hijau','the green-covered book','di rak dekat jendela','on the shelf by the window','daun pintu terayun pelan','the door swung gently'],
    ['penanda halaman','the bookmark','di sela buku sejarah','between the pages of the history book','suara gerimis terdengar di kanopi','drizzle sounded on the canopy'],
    ['daftar harga','the price list','di bawah kaca meja','under the glass tabletop','bel kecil di pintu berdenting sekali','the little doorbell rang once'],
    ['kotak karton','the cardboard box','di belakang rak','behind the shelf','angin membalik sudut kalender','the wind turned a corner of the calendar'],
    ['buku resep','the recipe book','di tumpukan paling atas','at the top of the stack','lampu jalan menyala di luar kios','the streetlight came on outside the kiosk'],
  ]},
  {person:'Salma',place:'ruang tunggu klinik',english:'the clinic waiting room',atmosphere:'di bawah cahaya lampu yang pucat',atmosphereEn:'a pale light shone overhead',objects:[
    ['nomor antrean','the queue ticket','di tangannya','in her hand','angka pada papan antrean berganti','the number on the queue board changed'],
    ['jaket krem','the cream jacket','di sandaran kursi','over the back of the chair','hujan mereda di luar jendela','the rain eased outside the window'],
    ['botol kecil','the small bottle','di saku tasnya','in her bag pocket','pintu ruang periksa terbuka','the examination room door opened'],
    ['lembar formulir','the form sheet','di atas meja samping','on the side table','kipas langit-langit berhenti berputar','the ceiling fan stopped turning'],
    ['kacamata','the glasses','di dalam sarungnya','inside their case','bel antrean berbunyi sekali','the queue bell rang once'],
  ]},
  {person:'Rani',place:'bengkel sepeda',english:'the bicycle workshop',atmosphere:'di tengah bau karet dan besi',atmosphereEn:'the air smelled of rubber and iron',objects:[
    ['kunci pas','the wrench','di samping roda belakang','beside the rear wheel','rantai sepeda berputar sebentar','the bicycle chain turned briefly'],
    ['ban cadangan','the spare tire','di rak dinding','on the wall rack','pintu bengkel tertiup angin','the workshop door moved in the wind'],
    ['pompa tangan','the hand pump','di bawah meja kerja','under the workbench','bel sepeda berdenting tanpa disengaja','the bicycle bell rang by accident'],
    ['lap minyak','the oily rag','di pinggir ember','by the bucket','tetes air jatuh dari atap seng','water dripped from the tin roof'],
    ['lampu kecil','the small lamp','di dekat kotak perkakas','near the toolbox','listrik padam beberapa detik','the power went out for a few seconds'],
  ]},
  {person:'Fajar',place:'pos pengamatan hutan',english:'the forest lookout',atmosphere:'sambil memandang pepohonan dari jendela',atmosphereEn:'he watched the trees through the window',objects:[
    ['teropong','the binoculars','di ambang jendela','on the windowsill','kabut menutup jalan setapak','mist covered the footpath'],
    ['peta jalur','the trail map','di dinding dekat pintu','on the wall by the door','panggilan burung terdengar dari timur','a bird called from the east'],
    ['senter hitam','the black flashlight','di atas meja','on the table','cahaya di lembah padam','the light in the valley went out'],
    ['buku laporan','the logbook','di laci bawah','in the lower drawer','angin mengguncang atap pos','the wind shook the lookout roof'],
    ['kompas','the compass','di saku rompinya','in his vest pocket','bayangan awan melintasi bukit','a cloud shadow crossed the hill'],
  ]},
  {person:'Ayu',place:'dapur rumah singgah',english:'the shelter kitchen',atmosphere:'di dekat jendela yang menghadap halaman',atmosphereEn:'a window overlooked the yard beside her',objects:[
    ['cangkir putih','the white cup','di ujung meja','at the end of the table','air dalam ketel mulai mendidih','water in the kettle began to boil'],
    ['kain serbet','the dishcloth','di gagang lemari','on the cabinet handle','jendela dapur bergetar tertiup angin','the kitchen window rattled in the wind'],
    ['buku menu','the menu book','di dekat kompor mati','beside the unlit stove','jam kecil berbunyi satu kali','the small clock rang once'],
    ['piring biru','the blue plate','di rak tengah','on the middle shelf','hujan mulai turun di halaman','rain began to fall in the yard'],
    ['keranjang rotan','the wicker basket','di bawah meja','under the table','lampu di atas bak cuci berkedip','the light above the sink flickered'],
  ]},
  {person:'Timo',place:'galeri gambar sekolah',english:'the school art gallery',atmosphere:'di bawah langit-langit yang tinggi',atmosphereEn:'the ceiling above him was high',objects:[
    ['sketsa pohon','the tree sketch','di dinding utara','on the north wall','cahaya sore bergeser di lantai','the afternoon light shifted across the floor'],
    ['kuas kecil','the small paintbrush','di dalam kotak kayu','in the wooden box','tirai bergerak karena angin','the curtain moved in the wind'],
    ['kertas gambar','the drawing paper','di meja panjang','on the long table','pintu galeri berdecit pelan','the gallery door creaked softly'],
    ['bingkai tipis','the thin frame','di balik lemari kaca','behind the glass cabinet','bel sekolah terdengar dari halaman','the school bell sounded from the yard'],
    ['cat air','the watercolors','di rak terbuka','on the open shelf','awan menghalangi cahaya jendela','a cloud blocked the window light'],
  ]},
  // Entire settings, characters and objects below are held out from training.
  {person:'Reka',place:'rumah kaca kebun kota',english:'the city garden greenhouse',atmosphere:'di antara deretan pot tanah liat',atmosphereEn:'rows of clay pots stood around her',objects:[
    ['label tanaman','the plant label','di samping pot tanah liat','beside the clay pot','embun mulai menempel pada kaca','dew began to settle on the glass'],
    ['kaleng penyiram','the watering can','di dekat pintu','near the door','bayangan pohon bergeser di lantai','a tree shadow moved across the floor'],
    ['sarung tangan','the gloves','di atas bangku bambu','on the bamboo bench','hujan mengetuk atap kaca','rain tapped on the glass roof'],
    ['buku kebun','the garden notebook','di rak bagian tengah','on the middle shelf','kipas ventilasi berhenti berputar','the ventilation fan stopped turning'],
    ['pot kecil','the small pot','di sudut jendela','in the corner of the window','cahaya matahari menembus awan','sunlight broke through the clouds'],
  ]},
  {person:'Dini',place:'ruang jahit sekolah',english:'the school sewing room',atmosphere:'di dekat rak berisi gulungan kain',atmosphereEn:'a shelf of fabric rolls stood nearby',objects:[
    ['pita kuning','the yellow ribbon','di atas meja potong','on the cutting table','mesin jahit berhenti berdengung','the sewing machine stopped humming'],
    ['jarum cadangan','the spare needle','di kotak benang','in the thread box','angin menggerakkan pola kertas','the wind moved the paper pattern'],
    ['gunting kain','the fabric scissors','di laci kanan','in the right drawer','bel sekolah berbunyi dua kali','the school bell rang twice'],
    ['gulungan benang','the spool of thread','di ujung rak','at the end of the shelf','hujan terdengar di jendela','rain sounded against the window'],
    ['meteran kain','the measuring tape','di sandaran kursi','over the back of the chair','lampu meja menyala kembali','the desk lamp came back on'],
  ]},
];

const variants = [
 {goal:'Sampaikan perubahan kecil dengan ritme tenang tanpa memindahkan benda.',label:'tenang',range:{min:38,max:51}},
 {goal:'Jaga ketegangan yang halus tanpa menciptakan peristiwa lain.',label:'tegang',range:{min:40,max:53}},
 {goal:'Tulis jelas dan hemat, dengan alur perhatian tokoh yang utuh.',label:'jernih',range:{min:44,max:57}},
];
const system='Anda menulis satu paragraf prosa Bahasa Indonesia alami dari draf bahasa Inggris dan batasan adegan. Hanya wujudkan fakta serta tindakan yang sudah ada. Jangan menambah tokoh, kejadian, benda, atau sebab; jangan memindahkan benda. Ikuti sudut pandang dan rentang kata. Balas dengan paragraf saja.';

function createExample(destination,index,variant,settingIndex){
 const [object,englishObject,position,englishPosition,signal,englishSignal]=destination.objects[index];
 const {person,place,english,atmosphere,atmosphereEn}=destination;
 const source=`${person} was waiting at ${english}; ${atmosphereEn}. ${englishObject[0].toUpperCase()+englishObject.slice(1)} remained ${englishPosition}. ${englishSignal[0].toUpperCase()+englishSignal.slice(1)}. ${person} noticed the change, stayed there thinking about it, and did not touch ${englishObject}.`;
 let target;
 if(variant.label==='tenang') target=`${person} menunggu di ${place}, ${atmosphere}. ${signal[0].toUpperCase()+signal.slice(1)}. ${object[0].toUpperCase()+object.slice(1)} tetap ${position}. Ia menangkap perubahan itu, tetapi tidak beranjak. ${person} tidak menyentuh ${object} dan terus menunggu, masih memikirkan apa yang baru saja terjadi.`;
 if(variant.label==='tegang') target=`${signal[0].toUpperCase()+signal.slice(1)} saat ${person} menunggu di ${place}, ${atmosphere}. Perhatiannya segera beralih pada kejadian itu. ${object[0].toUpperCase()+object.slice(1)} masih ${position}; ia tidak menyentuhnya. ${person} tetap di sana, menunggu sementara pikirannya kembali pada perubahan yang tadi ia perhatikan.`;
 if(variant.label==='jernih') target=`Di ${place}, ${person} menunggu ${atmosphere}. Perhatiannya beralih ketika ${signal}, tetapi ia tetap di tempat. ${object[0].toUpperCase()+object.slice(1)} tetap ${position}. Ia tidak menyentuh benda itu. ${person} hanya meneruskan penantiannya, sambil memikirkan perubahan yang baru saja ia sadari.`;
 const required_facts=[`${person} menunggu di ${place}.`,`${person} menunggu ${atmosphere}.`,`${object} tetap ${position}.`,`${signal}.`,`${person} memperhatikan dan memikirkan perubahan, tidak menyentuh ${object}, dan tetap menunggu.`];
 const forbidden_changes=[`${object} berpindah dari ${position}.`,`${person} menyentuh ${object}.`,'Tokoh, benda, sebab, atau kejadian baru muncul.'];
 const scene_goal=variant.goal;
 const input={source_draft_en:source,required_facts,forbidden_changes,pov:'third_person',target_word_range:variant.range,scene_goal,paragraphs:1};
 const family=`setting-${String(settingIndex+1).padStart(2,'0')}-scene-${index+1}`;
 return {id:`pc-${String(settingIndex+1).padStart(2,'0')}-${index+1}-${variant.label}`,family,provenance:'original_synthetic_v1',...input,target_id:target,messages:[{role:'system',content:system},{role:'user',content:JSON.stringify(input)},{role:'assistant',content:target}]};
}
const train=[],heldout=[];
destinations.forEach((place,settingIndex)=>place.objects.forEach((_,index)=>variants.forEach(variant=>(settingIndex<8?train:heldout).push(createExample(place,index,variant,settingIndex)))));
mkdirSync('qa/plan-c', {recursive:true});
for(const [split,rows] of [['train',train],['heldout',heldout]]){
 writeFileSync(`qa/plan-c/${split}.records.jsonl`,rows.map(({messages,...r})=>JSON.stringify(r)).join('\n')+'\n');
 writeFileSync(`qa/plan-c/${split==='train'?'train.nebius':'heldout.reference'}.jsonl`,rows.map(({messages})=>JSON.stringify({messages})).join('\n')+'\n');
}
console.log(JSON.stringify({train:train.length,heldout:heldout.length,trainingFamilies:40,heldoutFamilies:10}));
