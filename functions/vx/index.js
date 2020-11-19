'use strict';

//引入模块
const tcb = require('tcb-admin-node')
const sha1 = require('js-sha1')
const xmlreader = require('xmlreader')

//公众号服务器配置token值
const token = 'tokenvalues' //这里任意，英文和数字，后面需用到

//云开发初始化
tcb.init({
    env: 'envid' // 这里修改为环境id
})

//云开发鉴权
const auth = tcb.auth()
auth.getUserInfo()
//数据库初始化
const db = tcb.database()

exports.main = async (event, context) => {

    var response

    /**
     * 鉴权，判断请求是否来自微信官方服务器
     */
    var signature = event.queryStringParameters.signature
    var timestamp = event.queryStringParameters.timestamp
    var nonce = event.queryStringParameters.nonce
    var tmpArr = [token,timestamp,nonce]
    var tmpStr = sha1(tmpArr.sort().join(''))

    if(tmpStr == signature){

        // 鉴权成功

        return event.queryStringParameters.echostr //微信公众号接入验证，验证成功后删除这一行

        var requestData = event.body //请求携带的xml消息数据

        //如果数据被base64加密过，则解码
        if(event.isBase64Encoded) requestData = (new Buffer(requestData, 'base64')).toString() 

        //xml转json对象
        xmlreader.read(requestData, function(err,res){requestData = res})

        //提取消息内容，发送者，接受者，时间戳，消息类型，内容
        var FromUserName = requestData.xml.FromUserName.text(),
            ToUserName = requestData.xml.ToUserName.text(),
            CreateTime = Date.now(),
            MsgType = requestData.xml.MsgType.text(),
            Content = requestData.xml.Content.text(),
            From = '微信公众号'


        const adminCollection = db.collection('admin')
        const adminUser = await adminCollection.get()
        
        if(adminUser.data.length <= 0){
            //如果未绑定用户
            if(Content == '//bindCurrentUser'){
                var result = await adminCollection.add({open_id: FromUserName})
                if(result.hasOwnProperty('id')){
                    Content = '绑定成功'
                }else{
                    Content = '绑定失败'
                }
            }else{
                Content = '未绑定，回复 //bindCurrentUser 绑定当前账户'
            }
            
        }else if(adminUser.data[0].open_id == FromUserName){

            if(MsgType != 'text'){
                Content = '消息类型不允许'
            }else{
                //使用switch选择执行动作，以便后期扩展
                switch(Content){
                    case '//unbindCurrentUser' :
                        var result = await adminCollection.where({open_id: /.*/}).remove()
                        if(result.hasOwnProperty('code')){
                            Content = '解绑失败'
                        }else{
                            Content = '解绑成功'
                        }
                        break
                    default :
                        const talksCollection = db.collection('talks')
                        var result = await talksCollection.add({content: Content, date: new Date(CreateTime), from: From})
                        if(result.hasOwnProperty('id')){
                            Content = '发表成功'
                        }else{
                            Content = '发表失败'
                        }
                }
            }
        }else{
            return 'success'
        }
        //构造响应消息字符串
        response = '<xml>\
                        <ToUserName>'+FromUserName+'</ToUserName>\
                        <FromUserName>'+ToUserName+'</FromUserName>\
                        <CreateTime>'+CreateTime+'</CreateTime>\
                        <MsgType>'+MsgType+'</MsgType>\
                        <Content>'+Content+'</Content>\
                    </xml>'
    }else{
        // 鉴权失败
        response = {err: 'Request denied'}
    }

    return response

}