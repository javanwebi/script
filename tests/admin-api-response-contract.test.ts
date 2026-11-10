import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AdminApiError, adminApiNetworkMessage, requireAdminApiJson} from '../src/utils/adminApiResponse';

function reply(content: string, status: number, contentType = 'application/json') {
  return new Response(status === 204 ? null : content, {status, headers:{'content-type':contentType}});
}

test('CRM mutation accepts real JSON 201 response', async () => {
  const result = await requireAdminApiJson<{id:string}>(reply(
    JSON.stringify({success:true,id:'crm:crm-abc'}),201),'ثبت مشتری');
  assert.equal(result.id,'crm:crm-abc');
});

test('HTML 200 is not misreported as a database problem', async () => {
  await assert.rejects(
    requireAdminApiJson(reply('<!doctype html><html><body>SPA</body></html>',200,'text/html'),'ثبت مشتری'),
    error => {
      assert.ok(error instanceof AdminApiError);
      assert.equal(error.kind,'not-json');
      assert.equal(error.httpStatus,200);
      assert.match(error.message,/HTML/);
      assert.doesNotMatch(error.message,/SPA/);
      return true;
    }
  );
});

test('missing backend routes and proxy errors retain exact status and safe explanation', async () => {
  for (const [status,needle] of [[404,/نسخه فعال سرور/],[502,/پراکسی/],[504,/زمان مقرر/]] as const) {
    await assert.rejects(
      requireAdminApiJson(reply('<html>hidden proxy details</html>',status,'text/html'),'اتصال تصویر'),
      error => {
        assert.ok(error instanceof AdminApiError);
        assert.equal(error.httpStatus,status);
        assert.match(error.message,needle);
        assert.doesNotMatch(error.message,/hidden proxy details/);
        return true;
      }
    );
  }
});

test('JSON auth and database validation messages are preserved without a generic invalid server reply', async () => {
  await assert.rejects(
    requireAdminApiJson(reply(JSON.stringify({success:false,message:'این شماره قبلاً ثبت شده است.'}),409),'ثبت مشتری'),
    /این شماره قبلاً ثبت شده است/
  );
  await assert.rejects(
    requireAdminApiJson(reply(JSON.stringify({error:{message:'مبدأ درخواست مجاز نیست.'}}),403),'ثبت مشتری'),
    /مبدأ درخواست مجاز نیست/
  );
});

test('empty 2xx and malformed JSON never count as successful mutation', async () => {
  await assert.rejects(requireAdminApiJson(reply('',204),'ذخیره تصویر'),/HTTP 204/);
  await assert.rejects(requireAdminApiJson(reply('invalid',200),'ذخیره تصویر'),/HTTP 200/);
  await assert.rejects(requireAdminApiJson(reply('{"success":false}',200),'ذخیره تصویر'),/HTTP 200/);
});

test('ambiguous timeout warns against re-submitting a potentially completed write', () => {
  const message=adminApiNetworkMessage(new DOMException('timeout','TimeoutError'),'ثبت مشتری');
  assert.match(message,/قبل از ارسال دوباره/);
});

test('server and pre-promotion canary reject HTML or missing CRM/SKU mutation APIs', () => {
  const server=readFileSync('server.ts','utf8');
  const canary=readFileSync('ops/verify-single-port-canary.mjs','utf8');
  const fallback=server.indexOf("app.use('/api', (_req, res) =>");
  const staticFile=server.indexOf('app.use(express.static(distPath');
  assert.ok(fallback>0 && staticFile>fallback,'API JSON fallback must precede SPA');
  assert.match(server,/API_NOT_FOUND/);
  for (const route of [
    '/api/admin/crm/customers',
    '/api/catalog/sku-transfer',
    '/api/catalog/product-images/upload',
    '/api/catalog/category-images/upload',
    '/api/catalog/menu-family-assignment',
  ]) {
    assert.ok(canary.includes(route),route+' must be checked before release promotion');
  }
  assert.match(canary,/API_ROUTE_MISSING_OR_UNPROTECTED/);
  assert.match(canary,/API_NOT_FOUND_JSON_CONTRACT_OK/);
});
