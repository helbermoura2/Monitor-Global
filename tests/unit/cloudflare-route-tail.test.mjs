import {test} from 'node:test';import assert from 'node:assert/strict';import {classify} from '../../tools/cloudflare-route-tail.mjs';
test('route diagnostics discard query tokens, headers, exception text, logs and arbitrary paths',()=>{
 const item={outcome:'exceededCpu',event:{request:{url:'https://example.com/population-exposure?token=secret&lat=1',headers:{Authorization:'secret'}}},exceptions:[{message:'private'}],logs:[{message:['private']}]};
 assert.deepEqual(classify(item),{route:'/population-exposure',outcome:'exceededCpu'});
 item.event.request.url='https://example.com/private-token';assert.deepEqual(classify(item),{route:'other',outcome:'exceededCpu'});
});
